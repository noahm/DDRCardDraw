import { Flex, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  layout?: "vertical" | "horizontal";
}

/** centered placeholder content for empty or error states */
export function EmptyState(props: Props) {
  const layout = props.layout || "vertical";
  return (
    <Flex
      direction={layout === "vertical" ? "column" : "row"}
      align="center"
      justify="center"
      gap="md"
      p="md"
    >
      {props.icon}
      <Stack
        align={layout === "vertical" ? "center" : "flex-start"}
        gap="xs"
        maw="28em"
      >
        <Title order={4}>{props.title}</Title>
        {props.description && (
          <Text c="dimmed" ta={layout === "vertical" ? "center" : "left"}>
            {props.description}
          </Text>
        )}
        {props.action}
      </Stack>
    </Flex>
  );
}
