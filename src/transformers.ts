import {
  ErrorMap,
  buildHandleError,
  buildPassthroughHandleError
} from "./errors";
import { Result } from "./types";

export function flat<T>(source: AsyncGenerator<T>) {
  return map(source, (val, index, emit) => {
    if (!Array.isArray(val)) {
      return emit(val);
    }
    for (const item of val as T[]) {
      emit(item as T);
    }
  });
}

export function chunk<T>(source: AsyncGenerator<T>, size: number) {
  return reduce(
    source,
    (acc, val, index, done, emit) => {
      acc.push(val);
      if (acc.length === size) {
        emit(acc);
        return [];
      }
      return acc;
    },
    [] as T[],
    undefined,
    (acc, emit) => emit(acc)
  );
}

export async function* map<T, U>(
  source: AsyncGenerator<T>,
  fn: (
    val: T,
    index: number,
    emit: (val: U) => void,
    done: (val: U) => void
  ) => Result<void>,
  errorMap?: ErrorMap<T, U>
) {
  let i = 0;
  const emittable: U[] = [];
  let done = false;

  const handleError = errorMap
    ? buildHandleError(errorMap)
    : buildPassthroughHandleError();

  for await (const item of source) {
    try {
      await fn(
        item,
        i,
        (val) => {
          emittable.push(val);
        },
        (val) => {
          emittable.push(val);
          done = true;
        }
      );
      while (emittable.length > 0) {
        yield emittable.shift() as U;
      }
      if (done) break;
      i++;
    } catch (err) {
      const res = await handleError(err, item);
      if (res !== undefined) yield res;
    }
  }
}

export async function* filter<T>(
  source: Generator<T> | AsyncGenerator<T>,
  fn: (val: T, index: number) => Result<boolean>,
  errorMap?: ErrorMap<T, T>
) {
  let i = 0;
  if (errorMap) {
    const handleError = buildHandleError(errorMap);
    for await (const item of source) {
      try {
        if (await fn(item, i)) {
          yield item;
        }
        i++;
      } catch (err) {
        const res = await handleError(err, item);
        if (res !== undefined) yield res;
      }
    }
    return;
  }
  for await (const item of source) {
    if (await fn(item, i)) {
      yield item;
    }
    i++;
  }
}

export async function* reduce<T, U>(
  source: AsyncGenerator<T>,
  fn: (
    acc: U,
    val: T,
    index: number,
    done: (val: U) => U,
    emit: (val: U) => U
  ) => Result<U | void>,
  initialValue: U,
  errorMap?: ErrorMap<T, T>,
  onDone: (val: U, emit: (val: U) => U) => Result<U | void> = () => {}
) {
  let acc = initialValue;
  let aborted = false;
  const emittable: U[] = [];
  let isEmittingManually = false;
  let i = 0;

  const handleError = errorMap
    ? buildHandleError(errorMap)
    : buildPassthroughHandleError();
  for await (const item of source) {
    try {
      const res = await fn(
        acc,
        item,
        i,
        (val) => {
          aborted = true;
          return val;
        },
        (val) => {
          emittable.push(val);
          isEmittingManually = true;
          return val;
        }
      );
      if (res !== undefined) {
        acc = res as U;
      }
      i++;

      while (emittable.length > 0) {
        yield emittable.shift() as U;
      }

      if (aborted) {
        break;
      }
    } catch (err) {
      await handleError(err, item);
    }
  }

  if (!isEmittingManually) {
    yield acc;
    return;
  }

  await onDone(acc, (val) => {
    emittable.push(val);
    return val;
  });

  while (emittable.length > 0) {
    yield emittable.shift() as U;
  }
}

export async function* tap<T, U>(
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
      yield item;
    }
    return;
  }
  for await (const item of source) {
    await fn(item);
    yield item;
  }
}

export function take<T>(source: AsyncGenerator<T>, count: number) {
  return reduce(
    source,
    (acc, val, index, done) => {
      if (acc.length === count) {
        return done(acc);
      }
      acc.push(val);
      return acc;
    },
    [] as T[],
    undefined,
    (acc, emit) => emit(acc)
  );
}

export async function* unique<T>(source: AsyncGenerator<T>) {
  const res = new Set<T>();
  for await (const item of source) {
    if (!res.has(item)) {
      res.add(item);
      yield item;
    }
  }
}

export async function* uniqueBy<T, U>(
  source: AsyncGenerator<T>,
  fn: (data: T) => U
) {
  const res = new Set<U>();
  for await (const item of source) {
    const val = fn(item);
    if (!res.has(val)) {
      res.add(val);
      yield item;
    }
  }
}

export function split(
  source: AsyncGenerator<string>,
  separator: string | RegExp,
  limit?: number
) {
  return reduce(
    source,
    (acc, val, index, done, emit) => {
      const parts = val.split(separator, limit);
      for (const part of parts) {
        emit(part);
      }
    },
    ""
  );
}

export function join(source: AsyncGenerator<string>, delimiter: string = "") {
  return reduce(source, (acc, val) => acc + val + delimiter, "");
}

export async function* validate<T>(
  source: AsyncGenerator<T>,
  fn: (data: T) => Result<boolean>,
  errFn: (data: T) => Result<void>
) {
  for await (const item of source) {
    if (!(await fn(item))) {
      await errFn(item);
    }
    yield item;
  }
}
