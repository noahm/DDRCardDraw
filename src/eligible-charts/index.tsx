import { eligibleCharts } from "../card-draw";
import { useConfigState } from "../config-state";
import { useDrawState } from "../draw-state";
import { SongCard } from "../song-card";
import styles from "../drawing-list.css";
import { EligibleChart } from "../models/Drawing";
import {
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Spinner,
  InputGroup,
} from "@blueprintjs/core";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useAtom, atom, useAtomValue } from "jotai";
import { useDeferredValue, useMemo } from "react";
import { currentTabAtom, EligibleChartsListFilter } from "./filter";
import { DiffHistogram } from "./histogram";
import { isDegrs, TesterCard } from "../controls/degrs-tester";
import { usePackData } from "../pack-data";

function songKeyFromChart(chart: EligibleChart) {
  return `${chart.name}:${chart.artist}`;
}

const searchQueryInPack = atom<string>("");

export default function EligibleChartsList() {
  const packContents = usePackData((s) => {
    if (s.selectedPack && s.data) {
      return s.data[s.selectedPack];
    }
  });
  const [currentTab] = useDeferredValue(useAtom(currentTabAtom));
  const configState = useDeferredValue(useConfigState());
  const isNarrow = useIsNarrow();
  const query = useAtomValue(searchQueryInPack);
  const isDisplayFiltered = currentTab !== "all";

  // const charts = useMemo(
  //   () => (gameData ? Array.from(eligibleCharts(configState, gameData)) : []),
  //   [gameData, configState],
  // );

  if (!packContents) {
    return <Spinner />;
  }

  const filteredContents = useMemo(() => {
    return packContents.filter((chart) => {
      return chart.toLowerCase().includes(query.toLowerCase());
    });
  }, [packContents, query]);

  return (
    <>
      <Navbar
        style={{
          position: "sticky",
          top: "50px",
        }}
      >
        <NavbarGroup>
          {packContents.length} songs total{" "}
          {query ? `(${filteredContents.length} matching query)` : null}
        </NavbarGroup>
        <NavbarGroup>
          <NavbarDivider />
          <SearchInPack />
        </NavbarGroup>
      </Navbar>
      {/* <DiffHistogram charts={filteredCharts} /> */}
      <div className={styles.chartList}>
        {filteredContents.map((title, idx) => (
          <SongCard
            chart={{
              artist: "",
              name: title,
              bpm: "???",
              diffAbbr: "",
              diffColor: "",
              flags: [],
              jacket: "",
              id: idx.toString(),
              level: NaN,
            }}
            key={idx}
          />
        ))}
      </div>
    </>
  );
}

function SearchInPack() {
  const [query, setQuery] = useAtom(searchQueryInPack);
  return (
    <InputGroup
      type="search"
      leftIcon="search"
      value={query}
      onChange={(e) => setQuery(e.currentTarget.value)}
    />
  );
}
