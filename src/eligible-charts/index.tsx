import { SongCard } from "../song-card";
import styles from "../drawing-list.css";
import {
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Spinner,
  InputGroup,
} from "@blueprintjs/core";
import { useAtom, atom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { usePackData } from "../pack-data";

function PackList() {
  const availablePacks = usePackData((d) => d.data);
  const packnames = useMemo(() => {
    const ret = availablePacks ? Object.keys(availablePacks) : [];
    ret.sort((a, b) => a.localeCompare(b));
    return ret;
  }, [availablePacks]);
  if (!availablePacks) {
    return <Spinner />;
  }

  return (
    <div className={styles.chartList}>
      {packnames.map((title, idx) => (
        <SongCard
          chart={{
            artist: "",
            name: title,
            bpm: "",
            diffAbbr: "Songs",
            diffColor: "",
            flags: [],
            jacket: `https://card.lvarcade.net/songlist/jacket/${encodeURIComponent(
              title,
            )}`,
            id: idx.toString(),
            level: availablePacks[title].length,
          }}
          key={idx}
          onClick={() => usePackData.setState({ selectedPack: title })}
        />
      ))}
    </div>
  );
}

const searchQueryInPack = atom<string>("");

export default function EligibleChartsList() {
  const packName = usePackData((s) => s.selectedPack);
  const packContents = usePackData((s) => {
    if (s.selectedPack && s.data) {
      return s.data[s.selectedPack];
    }
  });
  // const [currentTab] = useDeferredValue(useAtom(currentTabAtom));
  // const configState = useDeferredValue(useConfigState());
  // const isNarrow = useIsNarrow();
  const query = useAtomValue(searchQueryInPack);
  // const isDisplayFiltered = currentTab !== "all";

  // const charts = useMemo(
  //   () => (gameData ? Array.from(eligibleCharts(configState, gameData)) : []),
  //   [gameData, configState],
  // );

  const filteredContents = useMemo(() => {
    if (!packContents) {
      return [];
    }
    return packContents.filter((chart) => {
      return chart.toLowerCase().includes(query.toLowerCase());
    });
  }, [packContents, query]);

  if (!packContents) {
    return <PackList />;
  }
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
              diffAbbr: "Lvl",
              diffColor: "darkgrey",
              flags: [],
              jacket: `https://card.lvarcade.net/songlist/jacket/${encodeURIComponent(
                packName!,
              )}/${encodeURIComponent(title)}`,
              id: idx.toString(),
              level: 0,
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
