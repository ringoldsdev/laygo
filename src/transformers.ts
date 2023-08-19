import { ErrorMap, buildHandleError } from "./errors";
import { Result } from "./types";

export async function* flat<T>(source: AsyncGenerator<T>) {
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

export async function* chunk<T>(source: AsyncGenerator<T>, size: number) {
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

export async function* map<T, U>(
  source: Generator<T> | AsyncGenerator<T>,
  fn: (val: T) => Result<U>,
  errorMap?: ErrorMap<T, U>
) {
  if (errorMap) {
    const handleError = buildHandleError(errorMap);
    for await (const item of source) {
      try {
        yield await fn(item);
      } catch (err) {
        const res = await handleError(err, item);
        if (res !== undefined) yield res;
      }
    }
    return;
  }

  for await (const item of source) {
    yield fn(item);
  }
}

export async function* filter<T>(
  source: Generator<T> | AsyncGenerator<T>,
  fn: (val: T) => Result<boolean>,
  errorMap?: ErrorMap<T, T>
) {
  if (errorMap) {
    const handleError = buildHandleError(errorMap);
    for await (const item of source) {
      try {
        if (await fn(item)) {
          yield item;
        }
      } catch (err) {
        const res = await handleError(err, item);
        if (res !== undefined) yield res;
      }
    }
    return;
  }
  for await (const item of source) {
    if (await fn(item)) {
      yield item;
    }
  }
}

export async function result<T>(source: AsyncGenerator<T>) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
  }
  return res;
}

export async function* reduce<T, U>(
  source: AsyncGenerator<T>,
  fn: (acc: U, val: T, done: (val: U) => U) => Result<U>,
  initialValue: U,
  errorMap?: ErrorMap<T, T>
) {
  let acc = initialValue;
  let aborted = false;

  if (errorMap) {
    const handleError = buildHandleError(errorMap);
    for await (const item of source) {
      try {
        const res = await fn(acc, item, (val) => {
          aborted = true;
          return val;
        });
        acc = res as U;
        if (aborted) {
          break;
        }
      } catch (err) {
        await handleError(err, item);
      }
    }
  } else {
    for await (const item of source) {
      const res = await fn(acc, item, (val) => {
        aborted = true;
        return val;
      });

      acc = res as U;
      if (aborted) {
        break;
      }
    }
  }
  yield acc;
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

export async function* take<T>(source: AsyncGenerator<T>, count: number) {
  const res: T[] = [];
  for await (const item of source) {
    res.push(item);
    if (res.length === count) {
      break;
    }
  }
  yield* res;
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

export async function* split(
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

export async function* join(
  source: AsyncGenerator<string>,
  delimiter: string = ""
) {
  let parts: string = "";
  for await (const item of source) {
    parts += item + delimiter;
  }
  yield parts;
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
