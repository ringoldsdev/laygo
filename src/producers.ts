import { EventEmitter, Readable, ReadableOptions } from "stream";
import readline from "readline";
import { Pipeline } from "./types";
import { pipeline } from "./pipeline";

export async function* arrayGenerator<T>(...sources: T[][]) {
  for (const source of sources) {
    for (const item of source) {
      yield item;
    }
  }
}

export async function* promiseGenerator<T>(...sources: Promise<T>[]) {
  for (const item of await Promise.all(sources)) {
    yield item;
  }
}

export async function* eagerPromiseGenerator<T>(...sources: Promise<T>[]) {
  const results: Array<Promise<T>> = sources.map((p) =>
    p.then((result) => result)
  );

  while (results.length > 0) {
    const index = await Promise.race(
      results.map((promise, i) => promise.then(() => i))
    );
    yield await results[index];
    results.splice(index, 1);
  }
}

export async function* streamGenerator(...sources: Readable[]) {
  for (const source of sources) {
    for await (const chunk of source) {
      yield chunk;
    }
    source.destroy();
  }
}

function mergeEventEmitters(...sources: EventEmitter[]) {
  if (sources.length === 1) return sources[0];

  const emitter = new EventEmitter();

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

export function eventEmitterGenerator(
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

export function streamLineReader(
  sources: Readable | Readable[],
  skipEmptyLines = false
) {
  const streams: Readable[] = [];

  for (const source of Array.isArray(sources) ? sources : [sources]) {
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

export async function* merge(...sources: AsyncGenerator[]): AsyncGenerator {
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

export function fromPipeline<P1>(p1: Pipeline<P1>): Pipeline<P1>;
export function fromPipeline<P1, P2>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>
): Pipeline<P1 | P2>;
export function fromPipeline<P1, P2, P3>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>
): Pipeline<P1 | P2 | P3>;
export function fromPipeline<P1, P2, P3, P4>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>
): Pipeline<P1 | P2 | P3 | P4>;
export function fromPipeline<P1, P2, P3, P4, P5>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function fromPipeline<P1, P2, P3, P4, P5, P6>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function fromPipeline<P1, P2, P3, P4, P5, P6, P7>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: Pipeline<P1>,
  p2: Pipeline<P2>,
  p3: Pipeline<P3>,
  p4: Pipeline<P4>,
  p5: Pipeline<P5>,
  p6: Pipeline<P6>,
  p7: Pipeline<P7>,
  p8: Pipeline<P8>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
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
export function fromPipeline<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
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
export function fromPipeline<T>(...sources: Pipeline<T>[]) {
  if (sources.length === 0) {
    return pipeline(sources[0].toGenerator());
  }
  return pipeline(merge(...sources.map((source) => source.toGenerator())));
}

export function fromGenerator<P1>(p1: AsyncGenerator<P1>): Pipeline<P1>;
export function fromGenerator<P1, P2>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>
): Pipeline<P1 | P2>;
export function fromGenerator<P1, P2, P3>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>
): Pipeline<P1 | P2 | P3>;
export function fromGenerator<P1, P2, P3, P4>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>
): Pipeline<P1 | P2 | P3 | P4>;
export function fromGenerator<P1, P2, P3, P4, P5>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function fromGenerator<P1, P2, P3, P4, P5, P6>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>,
  p6: AsyncGenerator<P6>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function fromGenerator<P1, P2, P3, P4, P5, P6, P7>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>,
  p6: AsyncGenerator<P6>,
  p7: AsyncGenerator<P7>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function fromGenerator<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>,
  p6: AsyncGenerator<P6>,
  p7: AsyncGenerator<P7>,
  p8: AsyncGenerator<P8>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function fromGenerator<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>,
  p6: AsyncGenerator<P6>,
  p7: AsyncGenerator<P7>,
  p8: AsyncGenerator<P8>,
  p9: AsyncGenerator<P9>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
export function fromGenerator<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: AsyncGenerator<P1>,
  p2: AsyncGenerator<P2>,
  p3: AsyncGenerator<P3>,
  p4: AsyncGenerator<P4>,
  p5: AsyncGenerator<P5>,
  p6: AsyncGenerator<P6>,
  p7: AsyncGenerator<P7>,
  p8: AsyncGenerator<P8>,
  p9: AsyncGenerator<P9>,
  p10: AsyncGenerator<P10>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;
export function fromGenerator<T>(...sources: AsyncGenerator<T>[]) {
  if (sources.length === 0) {
    return pipeline(sources[0]);
  }
  return pipeline(merge(...sources));
}

export function fromArray<P1>(p1: P1[]): Pipeline<P1>;
export function fromArray<P1, P2>(p1: P1[], p2: P2[]): Pipeline<P1 | P2>;
export function fromArray<P1, P2, P3>(
  p1: P1[],
  p2: P2[],
  p3: P3[]
): Pipeline<P1 | P2 | P3>;
export function fromArray<P1, P2, P3, P4>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[]
): Pipeline<P1 | P2 | P3 | P4>;
export function fromArray<P1, P2, P3, P4, P5>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[]
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function fromArray<P1, P2, P3, P4, P5, P6>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[],
  p6: P6[]
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function fromArray<P1, P2, P3, P4, P5, P6, P7>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[],
  p6: P6[],
  p7: P7[]
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function fromArray<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[],
  p6: P6[],
  p7: P7[],
  p8: P8[]
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function fromArray<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[],
  p6: P6[],
  p7: P7[],
  p8: P8[],
  p9: P9[]
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
export function fromArray<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: P1[],
  p2: P2[],
  p3: P3[],
  p4: P4[],
  p5: P5[],
  p6: P6[],
  p7: P7[],
  p8: P8[],
  p9: P9[],
  p10: P10[]
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;
export function fromArray<T>(...sources: T[][]) {
  if (sources.length === 0) {
    return pipeline(arrayGenerator(sources[0]));
  }
  return pipeline(merge(arrayGenerator(...sources)));
}

export function fromPromise<P1>(p1: Promise<P1>): Pipeline<P1>;
export function fromPromise<P1, P2>(
  p1: Promise<P1>,
  p2: Promise<P2>
): Pipeline<P1 | P2>;
export function fromPromise<P1, P2, P3>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>
): Pipeline<P1 | P2 | P3>;
export function fromPromise<P1, P2, P3, P4>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>
): Pipeline<P1 | P2 | P3 | P4>;
export function fromPromise<P1, P2, P3, P4, P5>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function fromPromise<P1, P2, P3, P4, P5, P6>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function fromPromise<P1, P2, P3, P4, P5, P6, P7>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function fromPromise<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function fromPromise<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>,
  p9: Promise<P9>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
export function fromPromise<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>,
  p9: Promise<P9>,
  p10: Promise<P10>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;
export function fromPromise<T>(...sources: Promise<T>[]) {
  if (sources.length === 0) {
    return pipeline(promiseGenerator(sources[0]));
  }
  return pipeline(promiseGenerator(...sources));
}

export function fromEagerPromise<P1>(p1: Promise<P1>): Pipeline<P1>;
export function fromEagerPromise<P1, P2>(
  p1: Promise<P1>,
  p2: Promise<P2>
): Pipeline<P1 | P2>;
export function fromEagerPromise<P1, P2, P3>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>
): Pipeline<P1 | P2 | P3>;
export function fromEagerPromise<P1, P2, P3, P4>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>
): Pipeline<P1 | P2 | P3 | P4>;
export function fromEagerPromise<P1, P2, P3, P4, P5>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function fromEagerPromise<P1, P2, P3, P4, P5, P6>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function fromEagerPromise<P1, P2, P3, P4, P5, P6, P7>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function fromEagerPromise<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function fromEagerPromise<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>,
  p9: Promise<P9>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
export function fromEagerPromise<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: Promise<P1>,
  p2: Promise<P2>,
  p3: Promise<P3>,
  p4: Promise<P4>,
  p5: Promise<P5>,
  p6: Promise<P6>,
  p7: Promise<P7>,
  p8: Promise<P8>,
  p9: Promise<P9>,
  p10: Promise<P10>
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;
export function fromEagerPromise<T>(...sources: Promise<T>[]) {
  if (sources.length === 0) {
    return pipeline(eagerPromiseGenerator(sources[0]));
  }
  return pipeline(eagerPromiseGenerator(...sources));
}

export function from<P1>(p1: P1): Pipeline<P1>;
export function from<P1, P2>(p1: P1, p2: P2): Pipeline<P1 | P2>;
export function from<P1, P2, P3>(
  p1: P1,
  p2: P2,
  p3: P3
): Pipeline<P1 | P2 | P3>;
export function from<P1, P2, P3, P4>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4
): Pipeline<P1 | P2 | P3 | P4>;
export function from<P1, P2, P3, P4, P5>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5
): Pipeline<P1 | P2 | P3 | P4 | P5>;
export function from<P1, P2, P3, P4, P5, P6>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6>;
export function from<P1, P2, P3, P4, P5, P6, P7>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7>;
export function from<P1, P2, P3, P4, P5, P6, P7, P8>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7,
  p8: P8
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8>;
export function from<P1, P2, P3, P4, P5, P6, P7, P8, P9>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7,
  p8: P8,
  p9: P9
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9>;
export function from<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10>(
  p1: P1,
  p2: P2,
  p3: P3,
  p4: P4,
  p5: P5,
  p6: P6,
  p7: P7,
  p8: P8,
  p9: P9,
  p10: P10
): Pipeline<P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function from(...sources: any[]) {
  return pipeline(arrayGenerator(sources));
}

export function fromReadableStream(...sources: Readable[]) {
  return pipeline<string>(streamGenerator(...sources));
}

export function fromEventEmitter(sources: EventEmitter | EventEmitter[]) {
  return pipeline(
    eventEmitterGenerator(Array.isArray(sources) ? sources : [sources])
  );
}

type FromStreamLineReaderOptions = {
  skipEmptyLines?: boolean;
};

export function fromStreamLineReader(
  sources: Readable[] | Readable,
  options?: FromStreamLineReaderOptions
) {
  return pipeline<string>(streamLineReader(sources, options?.skipEmptyLines));
}
