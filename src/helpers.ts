import { Pipeline } from "./types";

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
