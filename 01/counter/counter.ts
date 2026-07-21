export abstract class Counter {
  protected count: number;

  constructor(initialCount: number = 0) {
    this.count = initialCount;
  }

  abstract increment(): void;
  abstract decrement(): void;

  getCount(): number {
    return this.count;
  }
}