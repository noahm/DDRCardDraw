import { Group } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";

interface Props {
  left?: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
}

/** full-width toolbar, used as the app header and for secondary toolbars */
export function HeaderBar(props: Props) {
  return (
    <Group
      justify="space-between"
      px="md"
      h={50}
      wrap="nowrap"
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
