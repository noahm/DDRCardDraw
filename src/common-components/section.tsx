import {
  Card,
  Collapse,
  Group,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode, Ref } from "react";

interface Props {
  ref?: Ref<HTMLDivElement>;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** makes the header a toggle for the body; omit for an always-open section */
  collapse?: { opened: boolean; onToggle(this: void): void };
  children: ReactNode;
}

/** a bordered card with a titled header, optionally collapsible */
export function Section({
  ref,
  icon,
  title,
  subtitle,
  collapse,
  children,
}: Props) {
  const heading = (
    <Group gap="sm" wrap="nowrap" align="center">
      {icon}
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Title order={5}>{title}</Title>
        {subtitle && (
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        )}
      </Stack>
      {collapse &&
        (collapse.opened ? (
          <IconChevronDown size={16} />
        ) : (
          <IconChevronRight size={16} />
        ))}
    </Group>
  );
  return (
    <Card ref={ref} withBorder padding="sm">
      {collapse ? (
        <>
          <UnstyledButton
            onClick={collapse.onToggle}
            aria-expanded={collapse.opened}
          >
            {heading}
          </UnstyledButton>
          <Collapse expanded={collapse.opened}>
            <Card.Section withBorder mt="sm" p="sm">
              {children}
            </Card.Section>
          </Collapse>
        </>
      ) : (
        <>
          {heading}
          <Card.Section withBorder mt="sm" p="sm">
            {children}
          </Card.Section>
        </>
      )}
    </Card>
  );
}
