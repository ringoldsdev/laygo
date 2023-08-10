import { Result } from "./types";

export type ErrorMap<U> = {
  [key: string]: (err: Error, data: U) => Result<U | void>;
};

export function buildHandleError<U>(errorMap: ErrorMap<U>) {
  return async (err: Error, data: U) => {
    if (!errorMap[err.name]) {
      if (!errorMap["default"]) {
        throw err;
      }
      return await errorMap["default"](err, data);
    }
    return await errorMap[err.name](err, data);
  };
}
