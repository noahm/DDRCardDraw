/**
 * Map structure that automatically return a default value when you get a missing item
 */
export class DefaultingMap<Key, Value> {
  // static fromEntries<T>(entries: Array<[T, number]>): CountingSet<T> {
  //   const ret = new CountingSet<T>();
  //   ret.items = new Map(entries);
  //   return ret;
  // }

  private items = new Map<Key, Value>();
  constructor(private createDefault: (key: Key) => Value) {}

  public get size() {
    return this.items.size;
  }

  /** makes this usable in for-of loops */
  public [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }

  /** returns new count */
  public set(k: Key, v: Value) {
    this.items.set(k, v);
    return this;
  }

  public get(k: Key) {
    let item = this.items.get(k);
    if (!item) {
      item = this.createDefault(k);
      this.items.set(k, item);
    }
    return item;
  }

  public delete(k: Key) {
    return this.items.delete(k);
  }

  public has(k: Key) {
    return this.items.has(k);
  }

  public keys() {
    return this.items.keys();
  }

  public values() {
    return this.items.values();
  }

  public entries() {
    return this.items.entries();
  }
}
