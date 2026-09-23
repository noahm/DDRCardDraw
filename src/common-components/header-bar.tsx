import { Group } from "@mantine/core";
import type { CSSProperties, KeyboardEventHandler, ReactNode } from "react";
import { NAV_HEADER_ATTR } from "../utils/card-nav";

interface Props {
  left?: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
  /** marks this bar as the one arrow keys move to from the cards below it */
  navRegion?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

/** full-width toolbar, used as the app header and for secondary toolbars */
export function HeaderBar(props: Props) {
  return (
    <Group
      justify="space-between"
      px="md"
      h={50}
      wrap="nowrap"
      {...{ [NAV_HEADER_ATTR]: props.navRegion ? "" : undefined }}
      onKeyDown={props.onKeyDown}
      style={{
        backgroundColor: "var(--mantine-color-body)",
        borderBottom: "1px solid var(--mantine-color-default-border)",
        flex: "none",
        zIndex: 10,
        ...props.style,
      }}
    >
      <Group gap="sm" wrap="nowrap">
        {props.left}
      </Group>
      <Group gap="sm" wrap="nowrap">
        {props.right}
      </Group>
    </Group>
  );
}
