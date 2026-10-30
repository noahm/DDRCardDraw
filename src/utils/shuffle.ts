/**
 * is this an accurate F-Y shuffle? who knows!?!
 *
 * Kept out of the utils barrel because that file reads `navigator` as it
 * loads, and the party server -- which has no such thing -- reaches this by
 * way of the config store.
 */
export function shuffle<Item>(arr: Array<Item>): Array<Item> {
  const ret = arr.slice();
  for (let i = 0; i < ret.length; i++) {
    const randomUpcomingIndex =
      i + Math.floor(Math.random() * (ret.length - i));
    const currentItem = ret[i];
    ret[i] = ret[randomUpcomingIndex];
    ret[randomUpcomingIndex] = currentItem;
  }
  return ret;
}
