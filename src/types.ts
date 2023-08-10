import { Readable, ReadableOptions, Writable } from "stream";
import { ErrorMap } from "./errors";

export type Result<T> = T | Promise<T>;
type Unarray<T> = T extends Array<infer U> ? U : T;

export type ExistingPipeline<T, U> = (source: Pipeline<T>) => U;

type ConditionalWriteable<T> = {
  destination: Writable;
  condition: (data: T) => Result<boolean>;
};

export type PipeDestination<T> = Writable | ConditionalWriteable<T>;

export type Pipeline<T> = {
  map: <U>(fn: (val: T) => Result<U>, errorMap?: ErrorMap<T>) => Pipeline<U>;
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
  reduce: <U>(
    fn: (acc: U, val: T) => Result<U>,
    initialValue: U
  ) => Pipeline<U>;
  groupBy<U>(
    this: Pipeline<T extends Record<string | number | symbol, U> ? T : never>,
    key: keyof T
  );
  // You can specify type of this to restrict preceding values to be strings
  // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#specifying-the-type-of-this-for-functions
  split: (
    this: Pipeline<string>,
    separator: string | RegExp,
    limit?: number
  ) => Pipeline<string>;
  join: (this: Pipeline<string>, delimiter?: string) => Pipeline<string>;
  fork: () => Pipeline<T>;
};
