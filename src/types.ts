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
  map: <U>(
    fn: (val: T, index: number) => Result<U>,
    errorMap?: ErrorMap<T, U>
  ) => Pipeline<U>;
  filter: (
    fn: (val: T, index: number) => Result<boolean>,
    errorMap?: ErrorMap<T, T>
  ) => Pipeline<T>;
  take: (count: number) => Pipeline<T>;
  chunk: (size: number) => Pipeline<T[]>;
  flat: () => Pipeline<Unarray<T>>;
  flatMap: <U>(fn: (val: T) => Result<U[]>) => Pipeline<U>;
  collect: () => Pipeline<T[]>;
  apply: <U>(fn: ExistingPipeline<T, U>) => U;
  result: () => Promise<T[]>;
  each: <U>(
    fn: (val: T) => Result<U>,
    errorMap?: ErrorMap<T, U>,
    finalEmit?: boolean
  ) => Result<void>;
  tap: <U>(fn: (val: T) => Result<U>, errorMap?: ErrorMap<T, U>) => Pipeline<T>;
  unique: () => Pipeline<T>;
  uniqueBy: <U>(fn: (data: T) => U) => Pipeline<T>;
  toGenerator: () => AsyncGenerator<T>;
  toStream: (readableOptions?: ReadableOptions) => Readable;
  pipe: (...destinations: PipeDestination<T>[]) => Promise<void>;
  pipeFirst: (...destinations: PipeDestination<T>[]) => Promise<void>;
  reduce: <U>(
    fn: (
      acc: U,
      val: T,
      index: number,
      done: (val: U) => U,
      emit: (val: U) => U
    ) => Result<U | void>,
    initialValue: U,
    errorMap?: ErrorMap<T, T>,
    onDone?: (val: U, emit: (val: U) => U) => Result<U>
  ) => Pipeline<U>;
  groupBy: <U extends string | number | symbol>(
    fn: (data: T) => U,
    errorMap?: ErrorMap<T, T>
  ) => Pipeline<Record<U, T[]>>;
  // You can specify type of this to restrict preceding values to be strings
  // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#specifying-the-type-of-this-for-functions
  split: (
    this: Pipeline<string>,
    separator: string | RegExp,
    limit?: number
  ) => Pipeline<string>;
  join: (this: Pipeline<string>, delimiter?: string) => Pipeline<string>;
  fork: () => Pipeline<T>;
  validate: (
    fn: (data: T) => Result<boolean>,
    errFn: (data: T) => Result<void>
  ) => Pipeline<T>;
};
