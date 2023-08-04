import { laygo } from "@src/index";
import { EventEmitter, Readable } from "stream";

describe("producers", () => {
  it("should return value when using from", async () => {
    const value = await laygo.from(1).result();
    expect(value).toStrictEqual([1]);
  });
  it("should return value when using fromArray", async () => {
    const value = await laygo.fromArray([1, 2, 3]).result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should return value when using fromArray and multiple arrays", async () => {
    const value = await laygo.fromArray([1, 2], [3]).result();
    expect(value).toStrictEqual([1, 2, 3]);
  });
  it("should return value when using fromPromise", async () => {
    const fn = async () => [1, 2, 3];
    const value = await laygo.fromPromise(fn()).result();
    expect(value).toStrictEqual([[1, 2, 3]]);
  });
  it("should return value when using fromPromise and multiple promises", async () => {
    const fn = async () => 1;
    const fn2 = async () => 2;
    const fn3 = async () => 3;
    const promises = [fn(), fn2(), fn3()];
    const value = await laygo.fromPromise(...promises).result();
    expect(value).toStrictEqual([1, 2, 3]);
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
  it("should return value when using fromGenerator and multiple generators", async () => {
    const fn1 = async function* () {
      yield 1;
    };
    const fn2 = async function* () {
      yield 2;
    };
    const fn3 = async function* () {
      yield 3;
    };
    const value = await laygo.fromGenerator(fn1(), fn2(), fn3()).result();
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

    expect(value).toStrictEqual([1, 2, 3]);
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
    const stream = new Readable({ read() {} });

    const pipeline = laygo
      .fromStreamLineReader(stream, { skipEmptyLines: true })
      .result();

    stream.push("1\n2\n\n3\n\n");
    stream.push(null);

    const value = await pipeline;

    expect(value).toStrictEqual(["1", "2", "3"]);
  });

  it("should return value when using fromReadableStream without returning empty lines and using multiple streams", async () => {
    const stream1 = new Readable({ read() {} });
    const stream2 = new Readable({ read() {} });

    const pipeline = laygo
      .fromStreamLineReader([stream1, stream2], { skipEmptyLines: true })
      .result();

    stream1.push("1\n2\n\n");
    stream1.push(null);

    stream2.push("3\n\n");
    stream2.push(null);

    const value = await pipeline;

    expect(value).toStrictEqual(["1", "2", "3"]);
  });

  it("should return value when using fromPipeline", async () => {
    const pipeline = laygo.fromArray([1, 2, 3]);

    const value = await laygo.fromPipeline(pipeline).result();

    expect(value).toStrictEqual([1, 2, 3]);
  });

  it("should return value when using fromPipeline using multiple pipelines", async () => {
    const pipeline1 = laygo.fromArray([1, 2]);
    const pipeline2 = laygo.fromArray([3]);

    const value = await laygo.fromPipeline(pipeline1, pipeline2).result();

    expect(value).toStrictEqual([1, 2, 3]);
  });

  it("should return value when using fromEventEmitter", async () => {
    const emitter = new EventEmitter();

    const value = laygo.fromEventEmitter(emitter).result();

    emitter.emit("data", 1);
    emitter.emit("data", 2);
    emitter.emit("data", 3);
    emitter.emit("end");

    expect(await value).toStrictEqual([1, 2, 3]);
  });

  it("should return value when using fromEventEmitter using multiple event emitters", async () => {
    const emitter1 = new EventEmitter();
    const emitter2 = new EventEmitter();
    const emitter3 = new EventEmitter();

    const value = laygo
      .fromEventEmitter([emitter1, emitter2, emitter3])
      .result();

    emitter1.emit("data", 1);
    emitter1.emit("data", 2);
    emitter2.emit("data", 3);
    emitter2.emit("data", 4);
    emitter3.emit("data", 5);
    emitter3.emit("data", 6);
    emitter1.emit("end");
    emitter2.emit("end");
    emitter3.emit("end");

    expect(await value).toStrictEqual([1, 2, 3, 4, 5, 6]);
  });
});
