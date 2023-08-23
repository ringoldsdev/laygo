import * as laygo from "@src/index";
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
  it("should validate data", async () => {
    const fn = () =>
      laygo
        .fromArray([1, 2, 3])
        .validate(
          (v) => v > 2,
          (v) => {
            throw new Error(`${v} is less than or equal to 2`);
          }
        )
        .result();

    expect(fn).rejects.toStrictEqual(new Error("1 is less than or equal to 2"));
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
});
