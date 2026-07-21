export class Counter {
  protected count: number;

  constructor(initialCount: number = 0) {
    this.count = initialCount;
  }

  increment(): number{
    this.count++;
    return this.count;
  };

  decrement(): number{
    this.count--;
    return this.count;
  };

  getCount(): number {
    return this.count;
  }
}