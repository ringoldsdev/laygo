import { ReadableOptions } from "stream";
import { ForkableGenerator, createForkableGenerator } from "./fork";
import { PipeDestination, Pipeline, Result } from "./types";
import { ErrorMap } from "./errors";
import { pipe, pipeFirst, toStream, each, result } from "./consumers";
import {
  buffer,
  chunk,
  filter,
  flat,
  join,
  map,
  reduce,
  split,
  take,
  tap,
  unique,
  uniqueBy
} from "./transformers";

export function pipeline<T>(source: AsyncGenerator<T>): Pipeline<T> {
  let generator: AsyncGenerator<any> = source;

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
    map<U>(
      fn: (val: T, index: number) => Result<U>,
      errorMap?: ErrorMap<T, U>
    ) {
      generator = map(
        generator,
        async (val, index, emit) => {
          emit(await fn(val, index));
        },
        errorMap
      );
      return this;
    },
    eagerMap<U>(
      fn: (val: T, index: number) => Promise<U>[],
      errorMap?: ErrorMap<T, U>
    ) {
      generator = map(
        generator,
        async (val, index, emit) => {
          const results = fn(val, index);
          while (results.length > 0) {
            const index = await Promise.race(
              results.map((promise, i) => promise.then(() => i))
            );
            emit(await results[index]);
            results.splice(index, 1);
          }
        },
        errorMap
      );
      return this;
    },
    filter(
      fn: (val: T, index: number) => Result<boolean>,
      errorMap?: ErrorMap<T, T>
    ) {
      generator = filter(generator, fn, errorMap);
      return this;
    },
    reduce<U>(
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
    ) {
      generator = reduce(generator, fn, initialValue, errorMap, onDone);
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
    flatMap<U>(fn: (val: T, index: number) => Result<U[]>) {
      generator = flat(
        map(generator, async (val, index, emit) => emit(await fn(val, index)))
      );
      return this;
    },
    collect() {
      generator = reduce(generator, async (acc, val) => acc.concat(val), []);
      return this;
    },
    apply<U>(fn: (src: Pipeline<T>) => U) {
      return fn(this);
    },
    result() {
      return result(generator);
    },
    each<U>(fn: (val: T) => Result<U>, errorMap?: ErrorMap<T, U>) {
      return each(generator, fn, errorMap);
    },
    tap(fn: (val: T, index: number) => Result<any>, errorMap?: ErrorMap<T, T>) {
      generator = tap(generator, fn, errorMap);
      return this;
    },
    toGenerator() {
      return generator;
    },
    toStream: (readableOptions: ReadableOptions = {}) =>
      toStream(generator, readableOptions),
    pipe(...destinations: PipeDestination<T>[]) {
      return pipe(generator, destinations);
    },
    pipeFirst(...destinations: PipeDestination<T>[]) {
      return pipeFirst(generator, ...destinations);
    },
    unique() {
      generator = unique(generator);
      return this;
    },
    uniqueBy<U>(fn: (data: T) => U) {
      generator = uniqueBy(generator, fn);
      return this;
    },
    groupBy<U extends string | number | symbol>(
      fn: (data: T) => Result<U>,
      errorMap?: ErrorMap<T, T>
    ): Pipeline<Record<U, T[]>> {
      generator = reduce(
        generator,
        async (acc, val) => {
          const res = await fn(val);
          if (!(res in acc)) acc[res] = [];
          acc[res].push(val);
          return acc;
        },
        {} as Record<string | number | symbol, T[]>,
        errorMap
      );
      return this;
    },
    fork() {
      if (!forkedGenerator) {
        forkedGenerator = createForkableGenerator(generator);
      }
      return pipeline(forkedGenerator.fork());
    },
    await(fn: (data: T, index: number) => Promise<void>) {
      generator = tap(generator, fn);
      return this;
    },
    buffer(size: number): Pipeline<T> {
      generator = buffer(generator, size);
      return this;
    }
  };
}
