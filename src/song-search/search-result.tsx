import { JSX } from "react";
import { Group, Text, UnstyledButton } from "@mantine/core";
import { AbbrDifficulty } from "../game-data-utils";
import { useIntl } from "../hooks/useIntl";
import { Song, Chart } from "../models/SongData";
import { SongJacket } from "../song-jacket";
import styles from "./song-search.css";

export interface SearchResultData {
  song: Song;
  chart: Chart | "none";
}

interface ResultsProps {
  data: SearchResultData;
  selected: boolean;
  handleClick: React.MouseEventHandler<HTMLElement>;
}

export function SearchResult({ data, selected, handleClick }: ResultsProps) {
  const song = data.song;
  const { t } = useIntl();
  let label: string | JSX.Element;
  let disabled = false;
  if (typeof data.chart === "object") {
    label = (
      <>
        <AbbrDifficulty diffClass={data.chart.diffClass} /> {data.chart.lvl}
      </>
    );
  } else if (typeof data.chart === "string") {
    label = t("noMatchingCharts");
    disabled = true;
  } else {
    label = song.artist_translation || song.artist;
  }

  return (
    <UnstyledButton
      onClick={disabled ? undefined : handleClick}
      w="100%"
      px="sm"
      py={6}
      style={{
        borderRadius: "var(--mantine-radius-sm)",
        opacity: disabled ? 0.5 : undefined,
        backgroundColor: selected
          ? "var(--mantine-primary-color-light)"
          : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <SongJacket song={song} height={26} className={styles.img} />
          <Text size="sm" truncate>
            {song.name_translation || song.name}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
