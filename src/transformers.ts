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

export function filter<T>(
  source: AsyncGenerator<T>,
  fn: (val: T, index: number) => Result<boolean>,
  errorMap?: ErrorMap<T, T>
) {
  return map(
    source,
    (val, index, emit) => {
      if (fn(val, index)) {
        emit(val);
      }
    },
    errorMap
  );
}

export async function* reduce<T, U>(
  source: AsyncGenerator<T>,
  fn: (
    acc: U,
    val: T,
    index: number,
    emit: (val: U) => U,
    done: (val: U) => U
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

export function tap<T>(
  source: AsyncGenerator<T>,
  fn: (val: T, index: number) => any,
  errorMap?: ErrorMap<T, T>
) {
  return map(
    source,
    async (val, index, emit) => {
      await fn(val, index);
      emit(val);
    },
    errorMap
  );
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

export function uniqueBy<T, U>(source: AsyncGenerator<T>, fn: (data: T) => U) {
  const items = new Set<U>();
  return filter(source, (item) => {
    const val = fn(item);
    if (items.has(val)) {
      return false;
    }
    items.add(val);
    return true;
  });
}

export function unique<T>(source: AsyncGenerator<T>) {
  return uniqueBy(source, (val) => val);
}

export function split(
  source: AsyncGenerator<string>,
  separator: string | RegExp,
  limit?: number
) {
  return map(source, (val, index, emit) => {
    const parts = val.split(separator, limit);
    for (const part of parts) {
      emit(part);
    }
  });
}

export function join(source: AsyncGenerator<string>, delimiter: string = "") {
  return reduce(source, (acc, val) => acc + val + delimiter, "");
}

export async function* buffer<T>(source: AsyncGenerator<T>, size: number) {
  const queue: Promise<IteratorResult<T, any>>[] = [];

  while (queue.length < size) {
    queue.push(source.next());
  }

  while (queue.length > 0) {
    const res = await queue.shift();
    if (!res) continue;
    if (res?.done) break;
    yield res.value;
    queue.push(source.next());
  }
}
