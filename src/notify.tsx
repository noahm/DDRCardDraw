import {
  Notifications,
  notifications,
  type NotificationData,
} from "@mantine/notifications";
import styles from "./notify.css";

/**
 * Semantic flavor of a notification. Unlike Mantine's `color`, an intent also
 * fills the whole notification surface (see notify.css), which is how these
 * read at a glance on a stream or from across a venue.
 */
export type Intent = "success" | "warning" | "danger";

const intentColors: Record<Intent, string> = {
  success: "green",
  warning: "yellow",
  danger: "red",
};

const filledClassNames = {
  root: styles.filledRoot,
  icon: styles.filledIcon,
  title: styles.filledTitle,
  description: styles.filledDescription,
  closeButton: styles.filledCloseButton,
  loader: styles.filledLoader,
};

/**
 * Everything Mantine accepts for a notification, plus our `intent`. Prefer the
 * Mantine props directly (`title`, `loading`, `autoClose`, `allowClose`,
 * `icon`, `priority`, …) — this only adds the intent coloring on top.
 */
export interface NotifyOptions extends Omit<NotificationData, "color"> {
  intent?: Intent;
}

function toNotification({ intent, ...rest }: NotifyOptions): NotificationData {
  if (!intent) {
    return rest;
  }
  return {
    ...rest,
    color: intentColors[intent],
    classNames: filledClassNames,
  };
}

export const notify = {
  /** show a notification; pass `id` to be able to update or hide it later */
  show(options: NotifyOptions) {
    return notifications.show(toNotification(options));
  },
  /**
   * update a notification already on screen, in place. Handy for work that
   * starts pending and resolves later — the toast keeps its slot instead of
   * disappearing and popping back.
   */
  update(options: NotifyOptions & { id: string }) {
    return notifications.update(toNotification(options));
  },
  /** hide one notification by id */
  hide(id: string) {
    notifications.hide(id);
  },
  /** hide everything, on screen and queued */
  clean() {
    notifications.clean();
  },
};

export function NotificationHost() {
  return (
    <Notifications
      position="bottom-center"
      // event operators can stack up a few of these (copy, sync, updates);
      // beyond a handful they'd cover the cards they're drawing from
      limit={4}
      autoClose={5000}
    />
  );
}
