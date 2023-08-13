import * as laygo from "@src/index";
import { EventEmitter, Writable } from "stream";

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
          setTimeout(resolve, Math.random() * 8 + 2)
        );
        next();
      },
      highWaterMark: 1
    });

    const pipeline = laygo.fromArray([1, 2, 3]).pipe(destination);

    await pipeline;

    expect(res).toStrictEqual([1, 2, 3]);
  });
  it("should emit data events to a slow consumer", async () => {
    const res: number[] = [];

    const numberCount = 100;

    const destination = new Writable({
      objectMode: true,
      async write(chunk, encoding, next) {
        res.push(chunk);
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 8 + 2)
        );
        next();
      },
      highWaterMark: 1
    });

    const emitter = new EventEmitter();

    const pipeline = laygo.fromEventEmitter(emitter).pipe(destination);

    for (let i = 0; i < numberCount; i++) {
      emitter.emit("data", i + 1);
    }
    emitter.emit("end");

    await pipeline;

    expect(res).toStrictEqual(
      Array.from({ length: numberCount }, (_, i) => i + 1)
    );
  });
  it("should emit data events to multiple slow consumers", async () => {
    const newDestination = (res: number[]) => {
      return new Writable({
        objectMode: true,
        async write(chunk, encoding, next) {
          res.push(chunk);
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 8 + 2)
          );
          next();
        },
        highWaterMark: 1
      });
    };

    const res1: number[] = [];
    const res2: number[] = [];

    const destination1 = newDestination(res1);
    const destination2 = newDestination(res2);

    const pipeline = laygo
      .fromArray([1, 2, 3])
      .pipe(destination1, destination2);

    await pipeline;

    expect(res1).toStrictEqual([1, 2, 3]);
    expect(res2).toStrictEqual([1, 2, 3]);
  });
  it("should conditionally pipe data", async () => {
    const newDestination = (res: number[]) => {
      return new Writable({
        objectMode: true,
        async write(chunk, encoding, next) {
          res.push(chunk);
          next();
        },
        highWaterMark: 1
      });
    };

    const odd: number[] = [];
    const even: number[] = [];

    const destination1 = newDestination(odd);
    const destination2 = newDestination(even);

    const pipeline = laygo
      .fromArray([1, 2, 3])
      .pipe(
        { destination: destination1, condition: (val) => val % 2 !== 0 },
        { destination: destination2, condition: (val) => val % 2 === 0 }
      );

    await pipeline;

    expect(odd).toStrictEqual([1, 3]);
    expect(even).toStrictEqual([2]);
  });

  it("should write to first destination that returns true", async () => {
    const newDestination = (res: number[]) => {
      return new Writable({
        objectMode: true,
        async write(chunk, encoding, next) {
          res.push(chunk);
          next();
        },
        highWaterMark: 1
      });
    };

    const odd: number[] = [];
    const even: number[] = [];

    const destination1 = newDestination(odd);
    const destination2 = newDestination(even);

    const pipeline = laygo
      .fromArray([1, 2, 3])
      .pipeFirst(
        { destination: destination1, condition: (val) => val % 2 !== 0 },
        { destination: destination2, condition: (val) => val % 2 === 0 }
      );

    await pipeline;

    expect(odd).toStrictEqual([1, 3]);
    expect(even).toStrictEqual([2]);
  });
});
describe("error handling", () => {
  it("should handle each error", async () => {
    const res: number[] = [];
    await laygo.fromArray([1, 2, 3]).each(
      (v) => {
        if (v === 2) {
          throw new Error("I hate 2");
        }
        res.push(v);
      },
      {
        Error: () => {}
      }
    );
    expect(res).toStrictEqual([1, 3]);
  });
});
