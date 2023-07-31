import { z } from "zod";

type Result<T> = T | Promise<T>;
type Unarray<T> = T extends Array<infer U> ? U : T;

async function* sourceGenerator<T>(source: T[]) {
  for (const item of source) {
    yield item;
  }
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

async function* split<T>(
  source: AsyncGenerator<T>,
  separator: string | RegExp = ""
) {
  for await (const item of source) {
    yield (item as string).split(separator);
  }
}

async function* join<T>(source: AsyncGenerator<T>, separator: string = "") {
  const res: unknown[] = [];
  for await (const item of source) {
    res.push(item);
  }
  yield res.join(separator);
}

// async function* through<T, U>(
//   source: AsyncGenerator<T>,
//   fn: (source: AsyncGenerator<T>) => AsyncGenerator<U>
// ) {
//   for await (const item of fn(source)) {
//     yield item;
//   }
// }

type Pipeline<T> = {
  map: <U>(fn: (val: T) => Result<U>) => Pipeline<U>;
  filter: (fn: (val: T) => Result<boolean>) => Pipeline<T>;
  take: (count: number) => Pipeline<T>;
  chunk: (size: number) => Pipeline<T[]>;
  flat: () => Pipeline<Unarray<T>>;
  parseJson: () => Pipeline<unknown>;
  jsonStringify: (newLine?: boolean) => Pipeline<string>;
  // through: <U>(fn: (source: Pipeline<T>) => U) => Pipeline<U>;
  result: () => Result<T[]>;
  split: (separator?: string | RegExp) => Pipeline<string[]>;
  join: (separator?: string) => Pipeline<string>;
  toGenerator: () => AsyncGenerator<T>;
};

const pipelineBase = <T>(source: AsyncGenerator<T>): Pipeline<T> => {
  return {
    map: <U>(fn: (val: T) => Result<U>) => pipelineBase(map(source, fn)),
    filter: (fn: (val: T) => Result<boolean>) =>
      pipelineBase(filter(source, fn)),
    chunk: (size: number) => pipelineBase(chunk(source, size)),
    take: (count: number) => pipelineBase(take(source, count)),
    flat: () => pipelineBase(flat(source)),
    parseJson: () =>
      pipelineBase(map(source, (val) => JSON.parse(val as unknown as string))),
    jsonStringify: (newLine?: boolean) =>
      newLine
        ? pipelineBase(map(source, (val) => JSON.stringify(val) + "\n"))
        : pipelineBase(map(source, JSON.stringify)),
    // through: <U>(pipeline: (source: Pipeline<T>) => Pipeline<U>) =>
    //   pipelineBase(pipeline),
    result: () => result(source),
    toGenerator: () => source,
    split: (separator?: string | RegExp) =>
      pipelineBase(split(source, separator)),
    join: (separator?: string) => pipelineBase(join(source, separator))
  };
};

const pipeline = () => ({
  from: <T>(source: T[]) => {
    const generator = sourceGenerator(source);
    return pipelineBase(generator);
  }
});

(async () => {
  const res = await pipeline()
    .from(["abc", "def", "ghi"])
    .map((val) => val.toUpperCase())
    .map((val) => val.split(""))
    .take(2)
    .flat()
    .chunk(1)
    .flat()
    // .through(pipeline => pipeline.map(val => val + val))
    .result();
  console.log(res);

  const res2 = await pipeline()
    .from([
      JSON.stringify({ text: "Hello" }),
      JSON.stringify({ text: "World" })
    ])
    .parseJson()
    .map(z.object({ text: z.string() }).parse)
    .map(({ text }) => text.toUpperCase())
    .split()
    // .join(" ")
    // .through(pipeline => pipeline.map(val => val + val))
    .jsonStringify(true)
    .result();
  console.log(res2);
})();
