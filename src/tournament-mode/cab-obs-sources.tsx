import {
  AnchorButton,
  Card,
  CardList,
  FormGroup,
  HTMLSelect,
  NumericInput,
  Section,
  SectionCard,
} from "@blueprintjs/core";
import {
  DiagramTree,
  Duplicate,
  Font,
  Layers,
  MobileVideo,
  Numerical,
  People,
  Person,
  Tag,
} from "@blueprintjs/icons";
import { JSX, useState } from "react";
import { useHref } from "react-router-dom";
import { eventSlice } from "../state/event.slice";
import { useAppState } from "../state/store";
import { copyObsSource, routableCabSourcePath } from "./copy-obs-source";

import styles from "./cab-obs-sources.css";

interface CabSource {
  /** path stub which follows `source/` in the url */
  stub: string;
  label: string;
  icon: JSX.Element;
}

/** sources which exist exactly once per cab */
const perCabSources: CabSource[] = [
  { stub: "cards", label: "Cards", icon: <Layers /> },
  { stub: "title", label: "Title", icon: <Font /> },
  { stub: "phase", label: "Current Phase", icon: <DiagramTree /> },
  { stub: "players", label: "All Players", icon: <People /> },
];

/** sources which exist once per player of whatever match a cab is running */
function perPlayerSources(player: number): CabSource[] {
  return [
    { stub: `player/${player}`, label: "Name and Score", icon: <Person /> },
    { stub: `player/${player}/name`, label: "Name", icon: <Tag /> },
    { stub: `player/${player}/score`, label: "Score", icon: <Numerical /> },
  ];
}

const MAX_PLAYERS = 8;

export function CabObsSources() {
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const [pickedCabId, setPickedCabId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  // falls back to the first cab when the picked one has since been removed
  const cab = cabs.find((c) => c.id === pickedCabId) || cabs[0];

  return (
    <Section
      collapsible
      collapseProps={{ defaultIsOpen: false }}
      icon={<MobileVideo />}
      title="Cab OBS Sources"
      subtitle="Follow along with whichever match is assigned to a cab"
    >
      <SectionCard>
        {!cab ? (
          <p>Add a cab first to get source URLs for it.</p>
        ) : (
          <>
            <div className={styles.controls}>
              <FormGroup label="Cab" inline>
                <HTMLSelect
                  value={cab.id}
                  onChange={(e) => setPickedCabId(e.currentTarget.value)}
                  options={cabs.map((c) => ({ value: c.id, label: c.name }))}
                />
              </FormGroup>
              <FormGroup label="Players" inline>
                <NumericInput
                  value={playerCount}
                  onValueChange={(value) => {
                    if (Number.isNaN(value)) return;
                    setPlayerCount(Math.min(Math.max(value, 1), MAX_PLAYERS));
                  }}
                  min={1}
                  max={MAX_PLAYERS}
                  clampValueOnBlur
                  style={{ width: "4em" }}
                />
              </FormGroup>
            </div>
            <CardList compact>
              {perCabSources.map((source) => (
                <SourceCard key={source.stub} cabId={cab.id} source={source} />
              ))}
              {Array.from({ length: playerCount }, (_, i) =>
                perPlayerSources(i + 1).map((source) => (
                  <SourceCard
                    key={source.stub}
                    cabId={cab.id}
                    source={source}
                    group={`Player ${i + 1}`}
                  />
                )),
              )}
            </CardList>
          </>
        )}
      </SectionCard>
    </Section>
  );
}

function SourceCard({
  cabId,
  source,
  group,
}: {
  cabId: string;
  source: CabSource;
  group?: string;
}) {
  const href = useHref(routableCabSourcePath(cabId, source.stub));
  const fullUrl = new URL(href, document.location.href).href;
  return (
    <Card className={styles.sourceCard}>
      <span className={styles.sourceLabel}>
        {source.icon}
        <span>
          {group ? `${group}: ` : ""}
          {source.label}
        </span>
      </span>
      <code className={styles.sourceUrl} title={fullUrl}>
        {fullUrl}
      </code>
      <AnchorButton
        icon={<Duplicate />}
        title="Copy source URL"
        onClick={(e) => {
          e.preventDefault();
          copyObsSource(fullUrl);
        }}
        href={href}
      />
    </Card>
  );
}
