export class GameLoop {
  #update;
  #maxSecondsPerFrame;
  #isRunning = false;
  #previousTime = null;
  #animationFrameId = null;

  constructor(update, { maxSecondsPerFrame = 0.1 } = {}) {
    this.#update = update;
    this.#maxSecondsPerFrame = maxSecondsPerFrame;
  }

  start() {
    if (this.#isRunning) return this;
    this.#isRunning = true;
    this.#previousTime = null;
    this.#animationFrameId = requestAnimationFrame((time) => this.#frame(time));
    return this;
  }

  stop() {
    this.#isRunning = false;
    cancelAnimationFrame(this.#animationFrameId);
    return this;
  }

  #frame(time) {
    this.#animationFrameId = requestAnimationFrame((nextTime) => this.#frame(nextTime));
    const secondsSinceLastFrame =
      this.#previousTime === null
        ? 0
        : Math.min((time - this.#previousTime) / 1000, this.#maxSecondsPerFrame);
    this.#previousTime = time;
    this.#update(secondsSinceLastFrame);
  }
}
