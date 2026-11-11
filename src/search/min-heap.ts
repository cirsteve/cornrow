/** An instance-local binary min-heap; equal values retain comparator-defined order. */
export class MinHeap<T> {
  private readonly values: T[] = [];

  constructor(private readonly compare: (first: T, second: T) => number) {}

  get size(): number {
    return this.values.length;
  }

  push(value: T): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.values[parentIndex];
      if (parent === undefined || this.compare(value, parent) >= 0) break;
      this.values[index] = parent;
      index = parentIndex;
    }
    this.values[index] = value;
  }

  pop(): T | undefined {
    const root = this.values[0];
    const last = this.values.pop();
    if (this.values.length === 0 || last === undefined) return root;
    let index = 0;
    while (index * 2 + 1 < this.values.length) {
      let childIndex = index * 2 + 1;
      const left = this.values[childIndex];
      const right = this.values[childIndex + 1];
      if (left === undefined) break;
      if (right !== undefined && this.compare(right, left) < 0) childIndex += 1;
      const child = this.values[childIndex];
      if (child === undefined || this.compare(last, child) <= 0) break;
      this.values[index] = child;
      index = childIndex;
    }
    this.values[index] = last;
    return root;
  }
}
