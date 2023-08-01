## Laygo

Type-safe pipelines for Typescript.

Building pipelines shouldn't be difficult but existing packages didn't fit the bill.

**Rxjs** was too heavy for my needs

**Highland.js** was good, but it doesn't handle async (read stackoverflow and the issue list)

**Scramjet** doesn't have any type safety built into their setup

**ts-functional-pipe** is too basic and I don't like the way `pipe` and `compose` functions are implemented.

Goal is to take what I think are the best parts of those packages and create something very lightweight that also performs well.

### Example

```ts

const result = await laygo()
    .from(["Hello", "world"])
    .map(val => val.toUpperCase())
    .filter(val => ["HELLO"].includes(val))
    .split("")
    .chunk(2)
    .result();
```

Result will be `["WO","RL","D"]`

### How it works

By itself the example above is not that impressive but `from()` accepts streams and generators as well.

You can output a generator or await a result, but you can also pipe output into a stream and properly await until no data is coming through anymore.

Moreover, you can compose more complicated pipelines using the `through` function. It's incredubly useful when you have to reuse the same chunk of code across the codebase, but you care only about changing the core.

```ts
const schema = z.object({
    id: z.number(),
    name: z.string()
});

// you can be more strict with types as well
const pipeline = (p: Pipeline<unknown>) => laygo()
    .from(fs.createReadStream("./source.json"))
    .map(JSON.parse)
    .through(p)
    .map(JSON.stringify)
    .append("\n")
    .pipe(fs.createWriteStream("./destination.json"));

const result = await pipeline((laygo) =>
  laygo.map(schema.parse).filter(({ id }) => id < 100)
);
```

