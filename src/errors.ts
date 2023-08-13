import { Result } from "./types";

export type ErrorMap<T, U> = {
  [key: string]: (err: Error, data: T) => Result<U | void>;
};

export function buildHandleError<T, U>(errorMap: ErrorMap<T, U>) {
  return async (err: Error, data: T) => {
    if (!errorMap[err.name]) {
      if (!errorMap["default"]) {
        throw err;
      }
      return await errorMap["default"](err, data);
    }
    return await errorMap[err.name](err, data);
  };
}
