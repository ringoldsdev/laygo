import { laygo } from "@src/index";
import { Readable } from "stream";

describe("producers", () => {
  it("should return value when using from", async () => {
    const value = await laygo.from(1).result();
    expect(value).toStrictEqual([1]);
  });
  it("should return value when using fromArray", async () => {
    const value = await laygo.fromArray([1, 2, 3]).result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should return value when using fromPromise", async () => {
    const fn = async () => [1, 2, 3];
    const value = await laygo.fromPromise(fn()).result();
    expect(value).toStrictEqual([[1, 2, 3]]);
  });
  it("should return value when using fromPromise with a promise object", async () => {
    const promise = new Promise((resolve) => resolve([1, 2, 3]));
    const [value] = await laygo.fromPromise(promise).result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should return value when using fromGenerator", async () => {
    const fn = async function* () {
      yield 1;
      yield 2;
      yield 3;
    };
    const value = await laygo.fromGenerator(fn()).result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should return value when using fromReadableStream", async () => {
    // note that objectMode is required for this to work
    // otherwise the stream will be in buffer mode and return all the data at once
    const stream = new Readable({ objectMode: true, read() {} });

    const pipeline = laygo.fromReadableStream(stream).result();
    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.push(null);
    const value = await pipeline;

    expect(value).toStrictEqual(["1", "2", "3"]);
  });

  it("should return value when using fromReadableStream while returning empty lines", async () => {
    const stream = new Readable({ read() {} });

    const pipeline = laygo.fromStreamLineReader(stream).result();
    stream.push("1\n2\n3\n\n");
    stream.push(null);
    const value = await pipeline;

    expect(value).toStrictEqual(["1", "2", "3", ""]);
  });

  it("should return value when using fromReadableStream without returning empty lines", async () => {
    const stream = new Readable({ read() {} });

    const pipeline = laygo
      .fromStreamLineReader(stream, { skipEmptyLines: true })
      .result();

    stream.push("1\n2\n\n3\n\n");
    stream.push(null);

    const value = await pipeline;

    expect(value).toStrictEqual(["1", "2", "3"]);
  });
  it("should return value when using fromReadableStream without returning empty lines", async () => {
    const pipeline = laygo.fromArray([1, 2, 3]);

    const value = await laygo.fromPipeline(pipeline).result();

    expect(value).toStrictEqual([1, 2, 3]);
  });
});
