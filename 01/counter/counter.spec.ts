import { Counter } from './counter';
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Counter', () => {
    // Arrange

  let counter: Counter;

  beforeEach(() => {
    counter = new Counter(0);
  });

  it('should initialize with the given initial count', () => {
    // Assert
    expect(counter.getCount()).toBe(0);
  });

  it('should increment the count', () => {
    // Act
    let result = counter.increment();
    // Assert
    expect(result).toBe(1);
  });

  it('should decrement the count', () => {
    // Act
    let result = counter.decrement();
    // Assert
    expect(result).toBe(-1);
  });
});