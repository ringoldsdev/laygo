import { laygo } from "@src/index";
import { Helpers } from "@src/helpers";
import { Pipeline } from "@src/types";

describe("transformers", () => {
  it("should map values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .map((v) => v * 2)
      .result();
    expect(value).toStrictEqual([2, 4, 6]);
  });
  it("should filter values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .filter((v) => v % 2 === 0)
      .result();
    expect(value).toStrictEqual([2]);
  });
  it("should flatten values", async () => {
    const value = await laygo
      .fromArray([
        [1, 2],
        [3, 4]
      ])
      .flat()
      .result();
    expect(value).toStrictEqual([1, 2, 3, 4]);
  });
  it("should flatMap values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .flatMap((v) => [v, v])
      .result();
    expect(value).toStrictEqual([1, 1, 2, 2, 3, 3]);
  });
  it("should take 2 values", async () => {
    const value = await laygo.fromArray([1, 2, 3]).take(2).result();
    expect(value).toStrictEqual([1, 2]);
  });
  it("should chunk values", async () => {
    const value = await laygo.fromArray([1, 2, 3]).chunk(2).result();
    expect(value).toStrictEqual([[1, 2], [3]]);
  });
  it("should tap without changing value", async () => {
    let tapped = 0;
    const value = await laygo
      .fromArray([1, 2, 3])
      .tap((val) => tapped++)
      .result();
    expect(value).toStrictEqual([1, 2, 3]);
    expect(tapped).toStrictEqual(3);
  });
  it("should output unique values", async () => {
    const value = await laygo.fromArray([1, 2, 3, 2, 1]).unique().result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should reduce values", async () => {
    const [value] = await laygo
      .fromArray([
        1,
        2,
        3,
        { test: "test1", value: 1 },
        { test: "test2", value: 2 }
      ])
      .reduce("test")
      .result();
    expect(value).toStrictEqual({
      test1: [{ test: "test1", value: 1 }],
      test2: [{ test: "test2", value: 2 }],
      undefined: [1, 2, 3]
    });
  });
  it("should reduce values and ignore those that don't have the key set", async () => {
    const [value] = await laygo
      .fromArray([
        1,
        2,
        3,
        { test: "test1", value: 1 },
        { testt: "test2", value: 2 }
      ])
      .reduce("test", { ignoreUndefined: true })
      .result();
    expect(value).toStrictEqual({
      test1: [{ test: "test1", value: 1 }]
    });
  });
  it("should collect values", async () => {
    const value = await laygo.fromArray([1, 2, 3]).collect().result();
    expect(value).toStrictEqual([[1, 2, 3]]);
  });
  it("should split values", async () => {
    const value = await laygo.from("123").split("").result();
    expect(value).toStrictEqual(["1", "2", "3"]);
  });
  it("should join values", async () => {
    const [value] = await laygo.fromArray(["1", "2", "3"]).join().result();
    expect(value).toStrictEqual("123");
  });
  it("should handle errors", async () => {
    const fn = () =>
      laygo
        .fromArray(["1", "2", "3"])
        .map((val) => {
          throw new Error("Error");
        })
        .result();
    expect(fn).rejects.toThrow("Error");
  });
});
describe("helpers", () => {
  it("should apply a defined module", async () => {
    const module = (pipeline: Pipeline<number>) => pipeline.map((v) => v * 2);
    const value = await laygo.fromArray([1, 2, 3]).apply(module).result();
    expect(value).toStrictEqual([2, 4, 6]);
  });
  it("should parse json", async () => {
    const value = await laygo
      .fromArray(['{"test": "test"}', '{"test": "test2"}'])
      .apply(Helpers.parseJson)
      .result();
    expect(value).toStrictEqual([{ test: "test" }, { test: "test2" }]);
  });
  it("should stringify object", async () => {
    const value = await laygo
      .fromArray([{ test: "test" }, { test: "test2" }])
      .apply(Helpers.stringifyJson)
      .result();
    expect(value).toStrictEqual(['{"test":"test"}', '{"test":"test2"}']);
  });
});
