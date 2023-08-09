import { EventEmitter, Readable, ReadableOptions, Writable } from "stream";
import readline from "readline";
import events from "events";
import { ForkableGenerator, createForkableGenerator } from "./fork";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions

// TODO: add a handle function that wraps the pipeline and allows for local error handling
// maybe base it on the apply function but create a new pipeline under the hood?

// TODO: add throw function - should accept a function that either returns true or false and an error object
// TODO: map, filter, etc should accept a second parameter that handles errors
// second param should be an object where the key is an error type and the value is a function that handles the error

// TODO: deprecate branch function - it's not really needed
// TODO: improve reduce function to work closer to the array reduce function

type Result<T> = T | Promise<T>;
type Unarray<T> = T extends Array<infer U> ? U : T;

async function* arrayGenerator<T>(...sources: T[][]) {
  for (const source of sources) {
    for (const item of source) {
      yield item;
    }
  }
}

// TODO: deprecate in favour of merge function
async function* generatorGenerator<T>(...sources: AsyncGenerator<T>[]) {
  for (const source of sources) {
    for await (const item of source) {
      yield item;
    }
  }
}

function mergeEventEmitters(...sources: EventEmitter[]) {
  if (sources.length === 1) return sources[0];

  const emitter = new events.EventEmitter();

  let ended = 0;

  for (const source of sources) {
    source.on("data", (data) => emitter.emit("data", data));
    // end only when all event emitters have emitted end
    source.on("end", () => {
      ended++;
      if (ended === sources.length) emitter.emit("end");
    });
    source.on("error", (error) => emitter.emit("error", error));
  }

  return emitter;
}

function eventEmitterGenerator(
  sources: EventEmitter[],
  readableOptions: Omit<ReadableOptions, "objectMode"> = {}
) {
  const eventEmitter = mergeEventEmitters(...sources);

  const readable = new Readable({
    objectMode: true,
    read() {},
    ...readableOptions
  });

  eventEmitter.on("data", (data) => {
    readable.push(data);
  });
  eventEmitter.on("end", () => {
    readable.push(null);
  });

  return streamGenerator(readable);
}

async function* promiseGenerator<T>(...source: Promise<T>[]) {
  for (const item of await Promise.all(source)) {
    yield item;
  }
}

async function* streamGenerator(...sources: Readable[]) {
  for (const source of sources) {
    for await (const chunk of source) {
      yield chunk;
    }
    source.destroy();
  }
}

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

type ConditionalWriteable<T> = {
  destination: Writable;
  condition: (data: T) => Result<boolean>;
};

type PipeDestination<T> = Writable | ConditionalWriteable<T>;

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

async function pipe<T>(
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

async function pipeFirst<T>(
  source: AsyncGenerator<T>,
  destinations: [
    PipeDestination<T>,
    PipeDestination<T>,
    ...PipeDestination<T>[]
  ]
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

function streamLineReader(sources: Readable[], skipEmptyLines = false) {
  const streams: Readable[] = [];

  for (const source of sources) {
    const readable = new Readable({ objectMode: true, read: () => {} });

    const rl = readline.createInterface({
      input: source,
      crlfDelay: Infinity
    });

    if (skipEmptyLines) {
      rl.on("line", (line) => {
        if (line.length > 0) {
          readable.push(line);
        }
      });
    } else {
      rl.on("line", (line) => {
        readable.push(line);
      });
    }

    rl.on("close", () => {
      readable.push(null);
      source.destroy();
    });

    streams.push(readable);
  }
  return streamGenerator(...streams);
}

async function* flat<T>(source: AsyncGenerator<T>) {
  for await (const item of source) {
    if (!Array.isArray(item)) {
      yield item;
      continue;
    }
    for (const subItem of item) {
      yield subItem;
    }
  }
}

async function* chunk<T>(source: AsyncGenerator<T>, size: number) {
  let buffer: T[] = [];
  for await (const item of source) {
    buffer.push(item);
    if (buffer.length === size) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length) {
    yield buffer;
  }
}

async function* map<T, U>(
  source: Generator<T> | AsyncGenerator<T>,
  fn: (val: T) => Result<U>
) {
  for await (const item of source) {
    yield fn(item);
  }
}

async function* filter<T>(
  source: Generator<T> | AsyncGenerator<T>,
  fn: (val: T) => Result<boolean>
) {
  for await (const item of source) {
    if (await fn(item)) {
      yield item;
    }
  }
}

async function result<T>(source: AsyncGenerator<T>) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
  }
  return res;
}

async function each<T, U>(
  source: AsyncGenerator<T>,
  fn: (val: T) => Result<U>
) {
  for await (const item of source) {
    await fn(item);
  }
}

async function* reduce<T>(
  source: AsyncGenerator<T>,
  key: string | number | symbol,
  ignoreUndefined = false
) {
  const acc: Record<string, T[]> = {};
  for await (const item of source) {
    const value = item[key];
    if (ignoreUndefined && value === undefined) {
      continue;
    }
    if (!(value in acc)) {
      acc[value] = [item];
      continue;
    }
    acc[value].push(item);
  }
  yield acc;
}

async function* tap<T, U>(
  source: AsyncGenerator<T>,
  fn: (val: T) => Result<U>
) {
  for await (const item of source) {
    await fn(item);
    yield item;
  }
}

async function* collect<T>(source: AsyncGenerator<T>) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
  }
  yield res;
}

async function* take<T>(source: AsyncGenerator<T>, count: number) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
    if (res.length === count) {
      break;
    }
  }
  yield* res;
}

async function* unique<T>(source: AsyncGenerator<T>) {
  const res = new Set<T>();
  for await (const item of source) {
    if (!res.has(item)) {
      res.add(item);
      yield item;
    }
  }
}

async function* split(
  source: AsyncGenerator<string>,
  separator: string | RegExp,
  limit?: number
) {
  for await (const item of source) {
    const str = item.toString();
    const parts = str.split(separator, limit);
    for (const part of parts) {
      yield part;
    }
  }
}

async function* join(source: AsyncGenerator<string>, delimiter: string = "") {
  let parts: string = "";
  for await (const item of source) {
    parts += item + delimiter;
  }
  yield parts;
}

async function branch<T, U>(
  source: AsyncGenerator<T>,
  branches: ((src: Pipeline<T>) => U)[]
) {
  const events = new EventEmitter();

  const builtBranches = branches.map((branch) =>
    laygo.fromEventEmitter(events).apply(branch)
  );

  for await (const item of source) {
    events.emit("data", item);
  }
  events.emit("end");

  return builtBranches;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function* merge(...sources: AsyncGenerator<any>[]): AsyncGenerator<any> {
  while (sources.length > 0) {
    const res = await Promise.all(sources.map((source) => source.next()));
    for (const [index, { value, done }] of res.entries()) {
      if (done) {
        sources.splice(index, 1);
      } else {
        yield value;
      }
    }
  }
}

type ReduceOptions = {
  ignoreUndefined?: boolean;
};

type ExistingPipeline<T, U> = (source: Pipeline<T>) => U;

export type Pipeline<T> = {
  map: <U>(fn: (val: T) => Result<U>) => Pipeline<U>;
  filter: (fn: (val: T) => Result<boolean>) => Pipeline<T>;
  take: (count: number) => Pipeline<T>;
  chunk: (size: number) => Pipeline<T[]>;
  flat: () => Pipeline<Unarray<T>>;
  flatMap: <U>(fn: (val: T) => Result<U[]>) => Pipeline<U>;
  collect: () => Pipeline<T[]>;
  apply: <U>(fn: ExistingPipeline<T, U>) => U;
  result: () => Promise<T[]>;
  each: <U>(fn: (val: T) => Result<U>) => Result<void>;
  tap: <U>(fn: (val: T) => Result<U>) => Pipeline<T>;
  unique: () => Pipeline<T>;
  toGenerator: () => AsyncGenerator<T>;
  toStream: (readableOptions?: ReadableOptions) => Readable;
  pipe: (...destinations: PipeDestination<T>[]) => Promise<void>;
  pipeFirst: (
    ...destinations: [
      PipeDestination<T>,
      PipeDestination<T>,
      ...PipeDestination<T>[]
    ]
  ) => Promise<void>;
  reduce: (
    key: string | number | symbol,
    options?: ReduceOptions
  ) => Pipeline<Record<string, T[]>>;
  // You can specify type of this to restrict preceding values to be strings
  // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#specifying-the-type-of-this-for-functions
  split: (
    this: Pipeline<string>,
    separator: string | RegExp,
    limit?: number
  ) => Pipeline<string>;
  join: (this: Pipeline<string>, delimiter?: string) => Pipeline<string>;
  branch: <U>(...branches: ExistingPipeline<T, U>[]) => Promise<U[]>;
  // branch: <U>(...branches: ((src: Pipeline<T>) => U)[]) => Promise<U[]>;
  fork: () => Pipeline<T>;
};

function pipeline<T>(source: AsyncGenerator<T>): Pipeline<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let generator: AsyncGenerator<any> = source;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let forkedGenerator: ForkableGenerator<any>;
  return {
    split(this: Pipeline<string>, separator: string | RegExp, limit?: number) {
      generator = split(generator, separator, limit);
      return this;
    },
    join(this: Pipeline<string>, delimiter?: string) {
      generator = join(generator, delimiter);
      return this;
    },
    map<U>(fn: (val: T) => Result<U>) {
      generator = map(generator, fn);
      return this;
    },
    filter(fn: (val: T) => Result<boolean>) {
      generator = filter(generator, fn);
      return this;
    },
    chunk(size: number) {
      generator = chunk(generator, size);
      return this;
    },
    take(count: number) {
      generator = take(generator, count);
      return this;
    },
    flat() {
      generator = flat(generator);
      return this;
    },
    flatMap<U>(fn: (val: T) => Result<U[]>) {
      generator = flat(map(generator, fn));
      return this;
    },
    collect() {
      generator = collect(generator);
      return this;
    },
    apply<U>(fn: (src: Pipeline<T>) => U) {
      return fn(this);
    },
    result() {
      return result(generator);
    },
    each<U>(fn: (val: T) => Result<U>) {
      return each(generator, fn);
    },
    tap<U>(fn: (val: T) => Result<U>) {
      generator = tap(generator, fn);
      return this;
    },
    toGenerator() {
      return generator;
    },
    toStream(readableOptions: ReadableOptions = {}) {
      return generatorStream(generator, readableOptions);
    },
    pipe(...destinations: PipeDestination<T>[]) {
      return pipe(generator, destinations);
    },
    pipeFirst(
      ...destinations: [
        PipeDestination<T>,
        PipeDestination<T>,
        ...PipeDestination<T>[]
      ]
    ) {
      return pipeFirst(generator, destinations);
    },
    unique() {
      generator = unique(generator);
      return this;
    },
    reduce: (key: string | number | symbol, options?: ReduceOptions) =>
      pipeline(reduce(source, key, options?.ignoreUndefined)),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branch: async (...branches: ExistingPipeline<T, any>[]) => {
      return await branch(generator, branches);
    },
    fork: () => {
      if (!forkedGenerator) {
        forkedGenerator = createForkableGenerator(generator);
      }
      return pipeline(forkedGenerator.fork());
    }
  };
}

type FromStreamLineReaderOptions = {
  skipEmptyLines?: boolean;
};

function fromPipeline<P1>(p1: Pipeline<P1>): Pipeline<P1>;
function fromPipeline<P1, P2>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>
): Pipeline<P1 | P2>;
function fromPipeline<P1, P2, P3>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>
): Pipeline<P1 | P2 | P3>;
function fromPipeline<P1, P2, P3, P4>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>
): Pipeline<P1 | P2 | P3 | P4>;
function fromPipeline<P1, P2, P3, P4, P5>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>
): Pipeline<P1 | P2 | P3 | P4 | P5>;
function fromPipeline<P1, P2, P3, P4, P5, P6>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
function fromPipeline<P1, P2, P3, P4, P5, P6, P7>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>,
  p8: Pipeline<P8>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>,
  p8: Pipeline<P8>,
  p9: Pipeline<P9>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>,
  p8: Pipeline<P8>,
  p9: Pipeline<P9>,
  p10: Pipeline<P10>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;
function fromPipeline<T>(...sources: Pipeline<T>[]) {
  if (sources.length === 0) {
    return pipeline(sources[0].toGenerator());
  }
  return pipeline(merge(...sources.map((source) => source.toGenerator())));
}

export const laygo = {
  from: <T>(source: T) => pipeline(arrayGenerator([source])),
  // TODO: fromArray should support different input types
  fromArray: <T>(...sources: T[][]) => pipeline(arrayGenerator(...sources)),
  // TODO: fromGenerator should support different input types
  fromGenerator: <T>(...sources: AsyncGenerator<T>[]) =>
    pipeline(generatorGenerator(...sources)),
  // TODO: fromPromise should support different input types
  fromPromise: <T>(...sources: Promise<T>[]) =>
    pipeline(promiseGenerator(...sources)),
  fromReadableStream: (...sources: Readable[]) =>
    pipeline<string>(streamGenerator(...sources)),
  fromEventEmitter: (sources: EventEmitter | EventEmitter[]) =>
    pipeline(
      eventEmitterGenerator(Array.isArray(sources) ? sources : [sources])
    ),
  fromStreamLineReader: (
    sources: Readable[] | Readable,
    options?: FromStreamLineReaderOptions
  ) =>
    pipeline<string>(
      streamLineReader(
        Array.isArray(sources) ? sources : [sources],
        options?.skipEmptyLines
      )
    ),
  fromPipeline
};

export const Helpers = {
  trim: (pipeline: Pipeline<string>) => pipeline.map((val) => val.trim()),
  replace:
    (searchValue: string | RegExp, replaceValue: string) =>
    (pipeline: Pipeline<string>) =>
      pipeline.map((val) => val.replace(searchValue, replaceValue)),
  parseJson: (pipeline: Pipeline<string>) =>
    pipeline.map((val) => JSON.parse(val)),
  stringifyJson: <T>(pipeline: Pipeline<T>) =>
    pipeline.map((val) => JSON.stringify(val))
};
