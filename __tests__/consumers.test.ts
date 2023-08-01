import { laygo } from "@src/index";
import { PassThrough } from "stream";

describe("consumers", () => {
  it("should return value when using result", async () => {
    const value = await laygo.from(1).result();
    expect(value).toStrictEqual([1]);
  });
  it("should return value when using toGenerator", async () => {
    const value: number[] = [];
    for await (const v of laygo.from(1).toGenerator()) {
      value.push(v);
    }
    expect(value).toStrictEqual([1]);
  });
  it("should return value when using toStream using object mode", async () => {
    const value: number[] = [];
    for await (const v of laygo.from(1).toStream({ objectMode: true })) {
      value.push(v);
    }
    expect(value).toStrictEqual([1]);
  });
  it("should return value when using toStream", async () => {
    const value: string[] = [];
    for await (const v of laygo.from(1).toStream()) {
      value.push((v as Buffer).toString());
    }
    expect(value).toStrictEqual(["1"]);
  });
  it("should pipe output", async () => {
    const destination = new PassThrough({ objectMode: true, read() {} });
    const pipeline = laygo.fromArray([1, 2, 3]).pipe(destination);

    const res: number[] = [];

    for await (const v of destination) {
      res.push(v);
    }

    await pipeline;

    expect(res).toStrictEqual([1, 2, 3]);
  });
});
