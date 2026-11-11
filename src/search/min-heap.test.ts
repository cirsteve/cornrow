import { describe, expect, it } from 'vitest';
import { createPrng } from '../primitives/prng';
import { MinHeap } from './min-heap';

describe('binary min-heap', () => {
  it('handles an empty heap, a singleton and reuse after draining', () => {
    const heap = new MinHeap<number>((first, second) => first - second);
    expect(heap.pop()).toBeUndefined();
    expect(heap.size).toBe(0);
    heap.push(3);
    expect(heap.size).toBe(1);
    expect(heap.pop()).toBe(3);
    heap.push(1);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBeUndefined();
  });

  it('orders duplicates, negative values and interleaved operations', () => {
    const heap = new MinHeap<number>((first, second) => first - second);
    [5, -3, 2, 2, 9, 0].forEach(value => heap.push(value));
    expect(heap.pop()).toBe(-3);
    expect(heap.pop()).toBe(0);
    heap.push(-7);
    expect(Array.from({ length: heap.size }, () => heap.pop())).toEqual([-7, 2, 2, 5, 9]);
    expect(heap.size).toBe(0);
  });

  it('matches a sorted reference across a seeded mix of pushes and pops', () => {
    const heap = new MinHeap<number>((first, second) => first - second);
    const reference: number[] = [];
    const random = createPrng(72);
    for (let index = 0; index < 1000; index += 1) {
      if (random.next() < 0.65) {
        const value = random.nextInt(100) - 50;
        heap.push(value);
        reference.push(value);
        reference.sort((first, second) => first - second);
      } else expect(heap.pop()).toBe(reference.shift());
      expect(heap.size).toBe(reference.length);
    }
    expect(Array.from({ length: heap.size }, () => heap.pop())).toEqual(reference);
  });

  it('uses a custom comparator to break equal priorities deterministically', () => {
    interface Entry { priority: number; sequence: number }
    const heap = new MinHeap<Entry>((first, second) => first.priority - second.priority || first.sequence - second.sequence);
    const entries = [{ priority: 2, sequence: 0 }, { priority: 1, sequence: 2 }, { priority: 1, sequence: 1 }];
    entries.forEach(entry => heap.push(entry));
    expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([entries[2], entries[1], entries[0]]);
  });
});
