import { Readable, ReadableOptions, Writable } from "stream";
import { PipeDestination, Result } from "./types";
import events from "events";
import { ErrorMap, buildHandleError } from "./errors";

function generatorStream<T>(
  source: AsyncGenerator<T>,
  readableOptions: ReadableOptions = {}
) {
  const processValue = readableOptions.objectMode
    ? <T>(value: T) => value
    : <T>(value: T) => JSON.stringify(value);

  return new Readable({
    objectMode: false,
    read: async function () {
      const { value, done } = await source.next();
      if (done) {
        this.push(null);
        return;
      }
      this.push(processValue(value));
    },
    ...readableOptions
  });
}

export function toStream<T>(
  generator: AsyncGenerator<T>,
  readableOptions: ReadableOptions = {}
) {
  return generatorStream(generator, readableOptions);
}

const processPipeDestinations = <T>(destinations: PipeDestination<T>[]) => {
  return (Array.isArray(destinations) ? destinations : [destinations]).map(
    (destination) => {
      if (destination instanceof Writable) {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async isConditionMet(): Promise<boolean> {
            return true;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async write(data: any): Promise<boolean> {
            return destination.write(data);
          },
          async drain(isDraining: boolean) {
            if (isDraining) return;
            await events.once(destination, "drain");
            return;
          },
          end: destination.end.bind(destination)
        };
      }
      return {
        async isConditionMet(data: T): Promise<boolean> {
          return destination.condition(data);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async write(data: any): Promise<boolean> {
          return destination.destination.write(data);
        },
        async drain(isDraining: boolean) {
          if (isDraining) return;
          await events.once(destination.destination, "drain");
          return;
        },
        end: destination.destination.end.bind(destination.destination)
      };
    }
  );
};

export async function pipe<T>(
  source: AsyncGenerator<T>,
  destinations: PipeDestination<T>[]
) {
  const processedDestinations = processPipeDestinations(destinations);

  if (processedDestinations.length === 0) return;
  if (processedDestinations.length === 1) {
    const destination = processedDestinations[0];
    for await (const item of source) {
      const conditionMet = await destination.isConditionMet(item);
      if (!conditionMet) return;
      const isDraining = await destination.write(item);
      await destination.drain(isDraining);
    }
    destination.end();
    return;
  }

  for await (const item of source) {
    await Promise.all(
      processedDestinations.map(async (destination) => {
        const conditionMet = await destination.isConditionMet(item);
        if (!conditionMet) return;
        const isDraining = await destination.write(item);
        await destination.drain(isDraining);
      })
    );
  }
  for (const destination of processedDestinations) {
    destination.end();
  }
}

export async function pipeFirst<T>(
  source: AsyncGenerator<T>,
  ...destinations: PipeDestination<T>[]
) {
  const processedDestinations = processPipeDestinations(destinations);
  for await (const item of source) {
    for (const destination of processedDestinations) {
      const conditionMet = await destination.isConditionMet(item);
      if (!conditionMet) continue;
      const isDraining = await destination.write(item);
      await destination.drain(isDraining);
      break;
    }
  }
  for (const destination of processedDestinations) {
    destination.end();
  }
}

export async function each<T, U>(
  source: AsyncGenerator<T>,
  fn: (val: T) => Result<U>,
  errorMap?: ErrorMap<T, U>
) {
  if (errorMap) {
    const handleError = buildHandleError(errorMap);
    for await (const item of source) {
      try {
        await fn(item);
      } catch (err) {
        await handleError(err, item);
      }
    }
    return;
  }
  for await (const item of source) {
    await fn(item);
  }
}

export async function result<T>(source: AsyncGenerator<T>) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
  }
  return res;
}
