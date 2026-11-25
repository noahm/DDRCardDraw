/**
 * Tracks the health of the active partykit websocket outside of react and
 * redux, so store middleware can consult it synchronously. Lives apart from
 * app state to avoid being synced to the party server or other clients.
 */

let healthy = true;
let blockedActionHandler: (() => void) | undefined;

export function setPartyConnectionHealthy(value: boolean) {
  healthy = value;
}

export function isPartyConnectionHealthy() {
  return healthy;
}

/** registered by the socket manager to give user feedback when an action is dropped */
export function setBlockedActionHandler(handler: (() => void) | undefined) {
  blockedActionHandler = handler;
}

export function reportBlockedAction() {
  blockedActionHandler?.();
}
