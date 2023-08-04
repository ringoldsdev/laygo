import { laygo } from "@src/index";
import { EventEmitter, PassThrough, Writable } from "stream";

describe("branching", () => {
  it("should branch and write the same value to all destinations", async () => {
    const res = await laygo.fromArray([1, 2, 3]).branch(
      (pipeline) => pipeline.map((v) => v * v).result(),
      (pipeline) => pipeline.result()
    );
    // expect(branch1).toStrictEqual([1, 2, 3]);
    expect(await Promise.all(res)).toStrictEqual([
      [1, 4, 9],
      [1, 2, 3]
    ]);
  });
});
