import * as laygo from "@src/index";
import { createForkableGenerator } from "@src/fork";

describe("forking", () => {
  it("should fork a generator", async () => {
    const gen = createForkableGenerator(
      (async function* () {
        for (let i = 0; i < 3; i++) {
          yield i + 1;
        }
      })()
    );

    const fork1 = gen.fork();
    const fork2 = gen.fork();
    const fork3 = gen.fork();

    const results: number[][] = [[], [], []];

    await Promise.all(
      [fork1, fork2, fork3].map(async (f, i) => {
        for await (const v of f) {
          results[i].push(v);
        }
      })
    );

    expect(results).toStrictEqual([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3]
    ]);
  });

  it("should never run forked generators if not all of them are being consumed", async () => {
    const gen = createForkableGenerator(
      (async function* () {
        for (let i = 0; i < 3; i++) {
          yield i + 1;
        }
      })()
    );

    const fork1 = gen.fork();
    const fork2 = gen.fork();
    const _fork3 = gen.fork();

    const results: number[][] = [[], [], []];

    await Promise.race([
      Promise.all(
        [fork1, fork2].map(async (f, i) => {
          for await (const v of f) {
            results[i].push(v);
          }
        })
      ),
      new Promise((resolve) => setTimeout(resolve, 100))
    ]);

    expect(results).toStrictEqual([[], [], []]);
  });
  it("should fork a laygo pipeline", async () => {
    const pipeline = laygo.fromArray([1, 2, 3]);
    const fork1 = pipeline.fork();
    const fork2 = pipeline.fork();

    const [res1, res2] = await Promise.all([
      fork1.map((v) => v + 1).result(),
      fork2
        .map((v) => v * v)
        .map((v) => v.toString())
        .result()
    ]);

    expect(res1).toStrictEqual([2, 3, 4]);
    expect(res2).toStrictEqual(["1", "4", "9"]);
  });

  it("should fork a laygo pipeline as a generator and create another laygo pipeline that merges both sources", async () => {
    const pipeline = laygo.fromArray([1, 2, 3]);
    const fork1 = pipeline.fork();
    const fork2 = pipeline.fork();

    const pipeline1 = fork1.map((v) => v + 100);
    const pipeline2 = fork2.map((v) => v * v);

    const finalResult = await laygo.fromPipeline(pipeline1, pipeline2).result();
    expect(finalResult).toStrictEqual([101, 1, 102, 4, 103, 9]);
  });

  it("should fork a laygo pipeline and combine with a pipeline of different item count", async () => {
    const pipeline1 = laygo
      .fromArray([1, 2])
      .fork()
      .map((v) => v + 100);
    const pipeline2 = laygo.fromArray([1, 2, 3, 4]);

    const finalResult = await laygo.fromPipeline(pipeline1, pipeline2).result();
    expect(finalResult).toStrictEqual([101, 1, 102, 2, 3, 4]);
  });
});
