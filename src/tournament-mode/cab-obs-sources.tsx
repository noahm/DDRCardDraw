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
import { JSX, useCallback, useEffect, useRef, useState } from "react";
import { useHref, useSearchParams } from "react-router-dom";
import { eventSlice } from "../state/event.slice";
import { useAppState } from "../state/store";
import {
  CAB_SOURCES_PARAM,
  copyObsSource,
  routableCabSourcePath,
} from "./copy-obs-source";

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
  const [playerCount, setPlayerCount] = useState(2);
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRef = useRef<HTMLDivElement>(null);

  // the url holds this section's whole state: `?cab=<id>` both expands it and
  // says which cab it's showing, so any selection can be linked to directly
  const pickedCabId = searchParams.get(CAB_SOURCES_PARAM);
  const isOpen = pickedCabId !== null;
  // falls back to the first cab when the linked one has since been removed
  const cab = cabs.find((c) => c.id === pickedCabId) || cabs[0];

  // replace rather than push, so collapsing and switching cabs doesn't leave a
  // trail the back button has to walk through
  const showCab = useCallback(
    (cabId: string | undefined) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(CAB_SOURCES_PARAM, cabId || "");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const toggleOpen = useCallback(() => {
    if (!isOpen) {
      showCab(cab?.id);
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(CAB_SOURCES_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [cab?.id, isOpen, setSearchParams, showCab]);

  // arriving on a link that opens this section should put it in view, since
  // any number of text sources can be listed above it
  const [arrivedOpen] = useState(isOpen);
  useEffect(() => {
    if (arrivedOpen) {
      sectionRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [arrivedOpen]);

  return (
    <Section
      ref={sectionRef}
      collapsible
      collapseProps={{ isOpen, onToggle: toggleOpen }}
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
                  onChange={(e) => showCab(e.currentTarget.value)}
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
