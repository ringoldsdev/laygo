import { Readable, ReadableOptions, Writable } from "stream";
import readline from "readline";
import events from "events";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions

// TODO: add support for multiple sources (array of generator, string, array, promise, etc)
// TODO: make it possible to name all sources and names will get passed down along with data
// TODO: add support for multiple destinations
// TODO: make it possible to name all destinations and route data based on name

type Result<T> = T | Promise<T>;
type Unarray<T> = T extends Array<infer U> ? U : T;

async function* arrayGenerator<T>(source: T[]) {
  for (const item of source) {
    yield item;
  }
}

async function* promiseGenerator<T>(source: Promise<T>) {
  yield await source;
}

async function* streamGenerator(source: Readable) {
  for await (const chunk of source) {
    yield (chunk as Buffer).toString();
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

async function pipe<T>(source: AsyncGenerator<T>, destination: Writable) {
  for await (const item of source) {
    const canWrite = destination.write(item);
    if (canWrite) continue;
    await events.once(destination, "drain");
  }
  destination.end();
}

function streamLineReader(source: Readable, skipEmptyLines = false) {
  const passthrough = new Readable({ objectMode: true, read: () => {} });

  const rl = readline.createInterface({
    input: source,
    crlfDelay: Infinity
  });

  if (skipEmptyLines) {
    rl.on("line", (line) => {
      if (line.length > 0) {
        passthrough.push(line);
      }
    });
  } else {
    rl.on("line", (line) => {
      passthrough.push(line);
    });
  }

  rl.on("close", () => {
    passthrough.push(null);
  });

  return streamGenerator(passthrough);
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

type ReduceOptions = {
  ignoreUndefined?: boolean;
};

export type Pipeline<T> = {
  map: <U>(fn: (val: T) => Result<U>) => Pipeline<U>;
  filter: (fn: (val: T) => Result<boolean>) => Pipeline<T>;
  take: (count: number) => Pipeline<T>;
  chunk: (size: number) => Pipeline<T[]>;
  flat: () => Pipeline<Unarray<T>>;
  flatMap: <U>(fn: (val: T) => Result<U[]>) => Pipeline<U>;
  collect: () => Pipeline<T[]>;
  apply: <U>(fn: (source: Pipeline<T>) => U) => U;
  result: () => Result<T[]>;
  each: <U>(fn: (val: T) => Result<U>) => Result<void>;
  tap: <U>(fn: (val: T) => Result<U>) => Pipeline<T>;
  unique: () => Pipeline<T>;
  toGenerator: () => AsyncGenerator<T>;
  toStream: (readableOptions?: ReadableOptions) => Readable;
  pipe: (destination: Writable) => Promise<void>;
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
};

function pipeline<T>(source: AsyncGenerator<T>): Pipeline<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let generator: AsyncGenerator<any> = source;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn(this) as any;
      return this;
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
    pipe(destination: Writable) {
      return pipe(generator, destination);
    },
    unique() {
      generator = unique(generator);
      return this;
    },
    reduce: (key: string | number | symbol, options?: ReduceOptions) =>
      pipeline(reduce(source, key, options?.ignoreUndefined))
  };
}

type FromStreamLineReaderOptions = {
  skipEmptyLines?: boolean;
};

export const laygo = {
  from: <T>(source: T) => pipeline(arrayGenerator([source])),
  fromArray: <T>(source: T[]) => pipeline(arrayGenerator(source)),
  fromGenerator: <T>(source: AsyncGenerator<T>) => pipeline(source),
  fromPromise: <T>(source: Promise<T>) => pipeline(promiseGenerator(source)),
  fromReadableStream: (source: Readable) =>
    pipeline<string>(streamGenerator(source)),
  fromStreamLineReader: (
    source: Readable,
    options?: FromStreamLineReaderOptions
  ) => pipeline<string>(streamLineReader(source, options?.skipEmptyLines)),
  fromPipeline: <T>(source: Pipeline<T>) => pipeline(source.toGenerator())
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

export type Laygo = typeof laygo;
