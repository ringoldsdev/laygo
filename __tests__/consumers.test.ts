import { laygo } from "@src/index";
import { PassThrough, Writable } from "stream";

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
  it("should loop through each value", async () => {
    const value: number[] = [];
    await laygo.fromArray([1, 2, 3]).each((v) => value.push(v));
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should pipe output and manage backpressure", async () => {
    const res: number[] = [];

    const destination = new Writable({
      objectMode: true,
      async write(chunk, encoding, next) {
        res.push(chunk);
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 90 + 10)
        );
        next();
      },
      highWaterMark: 1
    });

    const pipeline = laygo.fromArray([1, 2, 3]).pipe(destination);

    await pipeline;

    expect(res).toStrictEqual([1, 2, 3]);
  });
});
