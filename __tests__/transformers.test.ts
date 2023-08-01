import { Pipeline, laygo } from "@src/index";

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
  it("should parseJson values", async () => {
    const value = await laygo
      .fromArray(['{"a":1}', '{"b":2}'])
      .parseJson()
      .result();
    expect(value).toStrictEqual([{ a: 1 }, { b: 2 }]);
  });
  it("should stringify values", async () => {
    const value = await laygo
      .fromArray([{ a: 1 }, { b: 2 }])
      .jsonStringify()
      .result();
    expect(value).toStrictEqual(['{"a":1}', '{"b":2}']);
  });
  it("should split values", async () => {
    const value = await laygo
      .fromArray(["a,b", "c,d"])
      .split(",")
      .flat()
      .result();
    expect(value).toStrictEqual(["a", "b", "c", "d"]);
  });
  it("should join values", async () => {
    const [value] = await laygo
      .fromArray(["a", "b", "c", "d"])
      .join(",")
      .result();
    expect(value).toStrictEqual("a,b,c,d");
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
  it("should apply a defined module", async () => {
    const module = (pipeline: Pipeline<number>) => pipeline.map((v) => v * 2);
    const value = await laygo.fromArray([1, 2, 3]).apply(module).result();
    expect(value).toStrictEqual([2, 4, 6]);
  });
});
