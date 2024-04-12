/**
 * Data structure to count the number of times a given item is added
 */
export class CountingSet<T> implements ReadonlyCountingSet<T> {
  static fromEntries<T>(entries: Array<[T, number]>): CountingSet<T> {
    const ret = new CountingSet<T>();
    ret.items = new Map(entries);
    return ret;
  }

  private items = new Map<T, number>();
  constructor(initialItems: ReadonlyArray<T> = []) {
    for (const item of initialItems) {
      this.add(item);
    }
  }

  public get size() {
    return this.items.size;
  }

  /** returns new count */
  public add(item: T, amt = 1) {
    const next = this.get(item) + amt;
    this.items.set(item, next);
    return next;
  }

  public get(item: T) {
    return this.items.get(item) || 0;
  }

  public has(item: T) {
    return this.items.has(item);
  }

  public values() {
    return this.items.keys();
  }

  public valuesWithCount() {
    return this.items.entries();
  }

  public freeze() {
    return this as ReadonlyCountingSet<T>;
  }
}

export interface ReadonlyCountingSet<T> {
  size: number;
  get(item: T): number;
  has(item: T): boolean;
  values(): IterableIterator<T>;
  valuesWithCount(): IterableIterator<[T, number]>;
}
