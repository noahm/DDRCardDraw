/**
 * Keyboard focus movement between song cards.
 *
 * Cards mark themselves with `data-card-nav`, and the list a card belongs to
 * (one drawn set, or the eligible charts grid) marks itself with
 * `data-card-group`. Left and right step through a card's own group in
 * document order, which follows the wrap of the flex rows. Up and down are
 * spatial instead: they land on the nearest card in the next row above or
 * below, which may be a later row of the same set, the set below it, or an
 * older draw further down the page. Stepping up past the top row hands focus
 * to the app header.
 */

export const CARD_NAV_ATTR = "data-card-nav";
export const CARD_GROUP_ATTR = "data-card-group";
/** marks the app header; arrow down from here re-enters the cards */
export const NAV_HEADER_ATTR = "data-nav-header";
/** the control in the header that focus lands on when arrowing up out of the cards */
export const NAV_HOME_ATTR = "data-nav-home";

/** the card that last held focus, so arrowing down from the header returns to it */
let lastFocusedCard: WeakRef<HTMLElement> | null = null;

export function noteCardFocused(card: HTMLElement) {
  lastFocusedCard = new WeakRef(card);
}

function isShown(el: HTMLElement) {
  // cards in a hidden tab panel or a collapsed section have no box at all
  return el.isConnected && el.getClientRects().length > 0;
}

function visibleCards(root: ParentNode = document) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[${CARD_NAV_ATTR}]`),
  ).filter(isShown);
}

export function focusCard(card: HTMLElement) {
  card.focus();
  card.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function groupOf(card: HTMLElement) {
  return card.closest<HTMLElement>(`[${CARD_GROUP_ATTR}]`);
}

/** the shown cards in `group`, in document order */
export function cardsInGroup(group: HTMLElement) {
  return visibleCards(group);
}

function horizontalNeighbor(card: HTMLElement, step: 1 | -1) {
  const group = groupOf(card);
  if (!group) return null;
  const cards = cardsInGroup(group);
  const idx = cards.indexOf(card);
  if (idx === -1) return null;
  return cards[idx + step] || null;
}

function verticalNeighbor(card: HTMLElement, direction: "up" | "down") {
  const from = card.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;

  // compare centers rather than edges: a vetoed card is scaled down in place,
  // so its edges sit inside its row-mates' but its center lines up with them
  const candidates = visibleCards()
    .filter((c) => c !== card)
    .map((c) => {
      const r = c.getBoundingClientRect();
      return { card: c, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })
    .filter(({ y }) => (direction === "down" ? y > from.bottom : y < from.top));
  if (!candidates.length) return null;

  const nearestRowY = candidates.reduce((best, c) =>
    Math.abs(c.y - fromY) < Math.abs(best.y - fromY) ? c : best,
  ).y;
  const row = candidates.filter(
    (c) => Math.abs(c.y - nearestRowY) < from.height / 2,
  );
  return row.reduce((best, c) =>
    Math.abs(c.x - fromX) < Math.abs(best.x - fromX) ? c : best,
  ).card;
}

function focusHeader() {
  const header = document.querySelector<HTMLElement>(`[${NAV_HEADER_ATTR}]`);
  if (!header) return false;
  const target =
    header.querySelector<HTMLElement>(`[${NAV_HOME_ATTR}]:not(:disabled)`) ||
    header.querySelector<HTMLElement>("button:not(:disabled), a[href]");
  if (!target) return false;
  target.focus();
  return true;
}

/**
 * Keydown handler for a card. Returns true when the key moved focus, so the
 * caller can stop the event from also scrolling the page.
 */
export function handleCardArrowKey(card: HTMLElement, key: string) {
  let next: HTMLElement | null = null;
  switch (key) {
    case "ArrowLeft":
      next = horizontalNeighbor(card, -1);
      break;
    case "ArrowRight":
      next = horizontalNeighbor(card, 1);
      break;
    case "ArrowDown":
      next = verticalNeighbor(card, "down");
      break;
    case "ArrowUp":
      next = verticalNeighbor(card, "up");
      if (!next) {
        return focusHeader();
      }
      break;
    default:
      return false;
  }
  if (next) {
    focusCard(next);
  }
  // an arrow at the edge of the grid still shouldn't scroll the page out from
  // under the focused card
  return true;
}

/**
 * Arrow down out of the header: back to the card that last had focus, or else
 * the first card on the page (the newest draw).
 */
export function focusCardFromHeader() {
  const last = lastFocusedCard?.deref();
  const target = last && isShown(last) ? last : visibleCards()[0];
  if (!target) return false;
  focusCard(target);
  return true;
}

/** the first shown card group on the page, which belongs to the newest draw */
export function firstGroupOnPage() {
  const groups = Array.from(
    document.querySelectorAll<HTMLElement>(`[${CARD_GROUP_ATTR}]`),
  ).filter(isShown);
  return groups[0] || null;
}

/**
 * Wait (up to `timeoutMs`) for a card group other than `previous` to become
 * the first on the page, then focus its first card. Used after a draw, which
 * lands at the top of the list once the store and the lazy list catch up.
 */
export function focusNewestDrawWhenReady(
  previous: HTMLElement | null,
  timeoutMs = 3000,
) {
  const start = performance.now();
  const tick = () => {
    const group = firstGroupOnPage();
    const card = group && group !== previous && cardsInGroup(group)[0];
    if (card) {
      focusCard(card);
      return;
    }
    if (performance.now() - start < timeoutMs) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/** true when nothing meaningful holds focus, so it is safe to move it */
export function focusIsAdrift() {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
}
