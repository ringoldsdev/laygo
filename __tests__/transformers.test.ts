import * as laygo from "@src/index";
import { Helpers } from "@src/helpers";
import { Pipeline } from "@src/types";
import { EventEmitter } from "stream";
import { once } from "events";

describe("transformers", () => {
  it("should map values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .map((v) => v * 2)
      .result();
    expect(value).toStrictEqual([2, 4, 6]);
  });
  it("should map value indexes", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .map((v, index) => index)
      .result();
    expect(value).toStrictEqual([0, 1, 2]);
  });
  it("should filter values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .filter((v) => v % 2 === 0)
      .result();
    expect(value).toStrictEqual([2]);
  });
  it("should filter every other value", async () => {
    const value = await laygo
      .fromArray(["a", "b", "c"])
      .filter((_, index) => (index + 1) % 2 !== 0)
      .result();
    expect(value).toStrictEqual(["a", "c"]);
  });
  it("should flatten values", async () => {
    const value = await laygo
      .fromArray([1, [2], [3, 4], ["5"]])
      .flat()
      .result();
    expect(value).toStrictEqual([1, 2, 3, 4, "5"]);
  });
  it("should flatMap values", async () => {
    const value = await laygo
      .fromArray([1, 2, 3])
      .flatMap((v) => [v, v])
      .result();
    expect(value).toStrictEqual([1, 1, 2, 2, 3, 3]);
  });
  it("should take 2 values", async () => {
    const [value] = await laygo.fromArray([1, 2, 3]).take(2).result();
    expect(value).toStrictEqual([1, 2]);
  });
  it("should try to take 2 values even if there aren't enough of them", async () => {
    const [value] = await laygo.fromArray([1]).take(2).result();
    expect(value).toStrictEqual([1]);
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
  it("should output unique values by key", async () => {
    const value = await laygo
      .fromArray([{ id: 1 }, { id: 1 }, { id: 2 }])
      .uniqueBy((val) => val.id)
      .result();
    expect(value).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should reduce values", async () => {
    const [value] = await laygo
      .fromArray([1, 2, 3])
      .reduce((acc, v) => acc + v, 0)
      .result();
    expect(value).toStrictEqual(6);
  });

  it("should reduce values and abort on condition", async () => {
    const [value] = await laygo
      .fromArray([1, 2, 3])
      .reduce((acc, v, _index, _initial, done) => {
        if (acc >= 3) {
          return done(acc);
        }
        return acc + v;
      }, 0)
      .result();
    expect(value).toStrictEqual(3);
  });

  it("should reduce values and emit each value", async () => {
    const value = await laygo
      .fromArray([1, 2, 3, 4])
      .reduce((acc, v, _index, done, emit) => {
        return emit(acc + v);
      }, 0)
      .result();
    expect(value).toStrictEqual([1, 3, 6, 10]);
  });

  it("should reduce values and emit each value except the final one which should still get emitted", async () => {
    const value = await laygo
      .fromArray([1, 2, 3, 4])
      .reduce(
        (acc, v, index, done, emit) => {
          if (index === 3) {
            return acc + v;
          }
          return emit(acc + v);
        },
        0,
        undefined,
        (val, done) => done(val)
      )
      .result();
    expect(value).toStrictEqual([1, 3, 6, 10]);
  });

  it("should reduce values but emit each and reset it", async () => {
    const value = await laygo
      .fromArray([1, 2, 3, 4])
      .reduce((acc, v, _index, done, emit) => {
        emit(acc + v);
        return;
      }, 0)
      .result();
    expect(value).toStrictEqual([1, 2, 3, 4]);
  });

  it("should reduce values and emit", async () => {
    const [value] = await laygo
      .fromArray([1, 2, 3])
      .reduce((acc, v, _index, _initial, done) => {
        if (acc >= 3) {
          return done(acc);
        }
        return acc + v;
      }, 0)
      .result();
    expect(value).toStrictEqual(3);
  });

  it("should group values by key", async () => {
    const [value] = await laygo
      .fromArray([{ key: "a" }, { key: "b" }, { key: "a" }])
      .groupBy((val) => (val.key === "a" ? "good" : "bad"))
      .result();
    expect(value).toStrictEqual({
      good: [{ key: "a" }, { key: "a" }],
      bad: [{ key: "b" }]
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

describe("transformer error handling", () => {
  const throwError = () => {
    throw new Error("err");
  };
  it("should map and handle errors", async () => {
    const res = await laygo
      .fromArray([1, 2, 3])
      .map(throwError, {
        default: () => 0
      })
      .result();

    expect(res).toStrictEqual([0, 0, 0]);
  });
  it("should map and handle any error using the default setting", async () => {
    const res = await laygo
      .fromArray([1, 2, 3])
      .map(throwError, {
        default: () => 0
      })
      .result();

    expect(res).toStrictEqual([0, 0, 0]);
  });
  it("should reduce and catch errors", async () => {
    const fn = () =>
      laygo
        .fromArray([1, 2, 3])
        .reduce(
          (acc, val) => {
            if (val === 2) throw new Error("Bad number");
            return acc + val;
          },
          0,
          {
            Error: (err, data) => {
              throw new Error("Intercepted number " + data);
            }
          }
        )
        .result();

    expect(fn).rejects.toStrictEqual(new Error("Intercepted number 2"));
  });
  it("should group and catch errors", async () => {
    const fn = () =>
      laygo
        .fromArray([1, 2, 3])
        .groupBy(
          (num) => {
            if (num === 2) throw new Error("Bad number");
            return num;
          },
          {
            Error: (err, data) => {
              throw new Error(err.message + " " + data);
            }
          }
        )
        .result();

    expect(fn).rejects.toStrictEqual(new Error("Bad number 2"));
  });
  it("should await callback", async () => {
    const e = new EventEmitter();
    e.on("sleep", (duration: number) => {
      setTimeout(() => {
        e.emit("callback");
      }, duration);
    });

    const res = await laygo
      .from(1)
      .tap(() => {
        e.emit("sleep", 10);
      })
      .await(async () => {
        await once(e, "callback");
      })
      .result();

    expect(res).toStrictEqual([1]);
  });

  it("should buffer data for a slow consumer", async () => {
    const loadTimeout = 2;
    const processTimeout = 3;
    const itemCount = 50;

    const startTime = process.hrtime();
    await laygo
      .fromGenerator(
        (async function* () {
          let i = 0;
          while (i < itemCount) {
            await new Promise((resolve) => setTimeout(resolve, loadTimeout));
            yield i;
            i++;
          }
        })()
      )
      .each(async (_) => {
        await new Promise((resolve) => setTimeout(resolve, processTimeout));
      });

    const endTime = process.hrtime(startTime);
    const endTimeMilliseconds = endTime[0] * 1000 + endTime[1] / 1000000;

    const startTimeBuffered = process.hrtime();
    await laygo
      .fromGenerator(
        (async function* () {
          let i = 0;
          while (i < itemCount) {
            await new Promise((resolve) => setTimeout(resolve, loadTimeout));
            yield i;
            i++;
          }
        })()
      )
      .buffer(2)
      .each(async (_) => {
        await new Promise((resolve) => setTimeout(resolve, processTimeout));
      });

    const endTimeBuffered = process.hrtime(startTimeBuffered);
    const endTimeMillisecondsBuffered =
      endTimeBuffered[0] * 1000 + endTimeBuffered[1] / 1000000;

    expect(endTimeMilliseconds).toBeGreaterThan(endTimeMillisecondsBuffered);

    expect(endTimeMillisecondsBuffered).toBeGreaterThanOrEqual(
      processTimeout * itemCount + loadTimeout
    );
    expect(endTimeMillisecondsBuffered).toBeLessThanOrEqual(
      processTimeout * itemCount + loadTimeout * itemCount
    );
  });
});
