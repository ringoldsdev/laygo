import EventEmitter, { once } from "events";

export function createForkableGenerator<T>(source: AsyncGenerator<T>) {
  const eventEmitter = new EventEmitter();
  let latestValue: T; // stores latest loaded value from the source generator
  let latestValuePendingGenerators = 0; // how many generators are waiting for the latestValue to be loaded
  let totalGenerators = 0;
  let initialisedGenerators = 0;
  let isDone = false; // whether the source generator is done
  let latestValueSet = false; // used in case latestValue is actually null or undefined
  let isLoading = false; // whether the event emitter is currently loading data from the source generator

  eventEmitter.on("init", async () => {
    initialisedGenerators++;
    if (initialisedGenerators === totalGenerators) {
      eventEmitter.emit("allReady");
    }
  });

  eventEmitter.on("start", async () => {
    latestValuePendingGenerators++;
  });

  eventEmitter.on("finish", async () => {
    latestValuePendingGenerators--;
    if (latestValuePendingGenerators > 0) return;
    if (isLoading) return; // meaning another generators event is already loading data
    isLoading = true;
    const { value, done } = await source.next();
    if (done) {
      isDone = true;
    } else {
      latestValue = value;
      latestValueSet = true;
    }
    eventEmitter.emit("refresh");
    isLoading = false;
  });

  return {
    fork(): AsyncGenerator<T> {
      totalGenerators++;
      return (async function* () {
        // listening has to happen before emitting init otherwise last forked generator will miss the event being emitted
        // because it will get emitted before this listener will get created
        const allReadyEvent = once(eventEmitter, "allReady");
        eventEmitter.emit("init");
        await allReadyEvent;
        while (!isDone) {
          const refreshEvent = once(eventEmitter, "refresh");
          eventEmitter.emit("start");
          if (latestValueSet) {
            yield latestValue;
          }
          eventEmitter.emit("finish");
          await refreshEvent;
        }
      })();
    }
  };
}

export type ForkableGenerator<T> = ReturnType<
  typeof createForkableGenerator<T>
>;
