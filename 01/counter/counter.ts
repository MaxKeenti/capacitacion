export class Counter {
  protected count: number;

  constructor(initialCount: number = 0) {
    this.count = initialCount;
  }

  increment(): number{
    return this.count++;
  };
  decrement(): number{
    return this.count--;
  };

  getCount(): number {
    return this.count;
  }
}