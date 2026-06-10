import { Notifications, notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconClipboard,
  IconExclamationCircle,
  IconPaperclip,
} from "@tabler/icons-react";
import { Button } from "@mantine/core";
import type { JSX, ReactNode } from "react";

type IconName = "error" | "clipboard" | "paperclip" | "warning-sign";

interface ToastProps {
  message: ReactNode;
  icon?: JSX.Element | IconName;
  intent?: "primary" | "success" | "warning" | "danger";
  /** in milliseconds, 0 keeps the toast open until dismissed */
  timeout?: number;
  action?: {
    text: ReactNode;
    onClick: () => void;
  };
}

const intentColors = {
  primary: "blue",
  success: "green",
  warning: "yellow",
  danger: "red",
} as const;

function resolveIcon(icon: ToastProps["icon"]): ReactNode {
  switch (icon) {
    case "error":
      return <IconExclamationCircle />;
    case "clipboard":
      return <IconClipboard />;
    case "paperclip":
      return <IconPaperclip />;
    case "warning-sign":
      return <IconAlertTriangle />;
    default:
      return icon;
  }
}

export const toaster = {
  show(props: ToastProps, key?: string) {
    if (key) {
      notifications.hide(key);
    }
    notifications.show({
      id: key,
      message: props.action ? (
        <>
          {props.message}{" "}
          <Button
            size="compact-sm"
            variant="light"
            onClick={props.action.onClick}
          >
            {props.action.text}
          </Button>
        </>
      ) : (
        props.message
      ),
      icon: resolveIcon(props.icon),
      color: props.intent ? intentColors[props.intent] : undefined,
      autoClose: props.timeout === 0 ? false : props.timeout,
    });
  },
  clear() {
    notifications.clean();
  },
};

export function ToasterHost() {
  return <Notifications position="bottom-center" />;
}
