import { Counter } from './counter';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Counter', () => {
    // Arrange
  class TestCounter extends Counter {
    increment(): void {
      this.count++;
    }

    decrement(): void {
      this.count--;
    }
  }

  let counter: TestCounter;

  beforeEach(() => {
    counter = new TestCounter(0);
  });

  it('should initialize with the given initial count', () => {
    // Assert
    expect(counter.getCount()).toBe(0);
  });

  it('should increment the count', () => {
    // Act
    counter.increment();
    // Assert
    expect(counter.getCount()).toBe(1);
  });

  it('should decrement the count', () => {
    // Act
    counter.decrement();
    // Assert
    expect(counter.getCount()).toBe(-1);
  });
});