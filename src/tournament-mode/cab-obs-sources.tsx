import {
  Button,
  CardList,
  FormGroup,
  HTMLSelect,
  NumericInput,
  Section,
  SectionCard,
  Tooltip,
} from "@blueprintjs/core";
import {
  DiagramTree,
  Font,
  Layers,
  MobileVideo,
  People,
  Person,
  Th,
} from "@blueprintjs/icons";
import { JSX, useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "../hooks/useIntl";
import { useHref, useSearchParams } from "react-router-dom";
import {
  cardsSourceStub,
  defaultVetoMode,
  VetoMode,
  vetoModes,
} from "../obs-sources/card-options";
import {
  defaultPlayerFields,
  inRenderOrder,
  PlayerField,
  playerFields,
  playerSourceStub,
} from "../obs-sources/player-fields";
import { eventSlice } from "../state/event.slice";
import { useAppState } from "../state/store";
import { CAB_SOURCES_PARAM, routableCabSourcePath } from "./copy-obs-source";
import { SourceRow } from "./obs-source-row";

import styles from "./cab-obs-sources.css";

interface CabSource {
  /** path stub which follows `source/` in the url */
  stub: string;
  label: string;
  icon: JSX.Element;
}

/** sources which exist exactly once per cab and take no options */
const perCabSources: CabSource[] = [
  { stub: "title", label: "Title", icon: <Font /> },
  { stub: "phase", label: "Current Phase", icon: <DiagramTree /> },
  { stub: "standings", label: "Gauntlet Standings", icon: <Th /> },
  { stub: "players", label: "All Players", icon: <People /> },
];

const MAX_PLAYERS = 8;

export function CabObsSources() {
  const cabs = useAppState(eventSlice.selectors.allCabs);
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
            </div>
            <CardList compact>
              <CardsSourceCard cabId={cab.id} />
              {perCabSources.map((source) => (
                <SourceCard key={source.stub} cabId={cab.id} source={source} />
              ))}
              <PlayerSourceCard cabId={cab.id} />
            </CardList>
          </>
        )}
      </SectionCard>
    </Section>
  );
}

/**
 * The cards row, which says on its own whether it shows a match's bans. There
 * is no room-wide setting behind it any more -- every other client answers that
 * for itself -- so the url is the whole answer, and two scenes off one cab can
 * differ.
 */
function CardsSourceCard({ cabId }: { cabId: string }) {
  const { t } = useIntl();
  const [mode, setMode] = useState<VetoMode>(defaultVetoMode);
  const href = useHref(routableCabSourcePath(cabId, cardsSourceStub(mode)));

  return (
    <SourceRow
      href={href}
      label={
        <>
          <Layers />
          <span>Cards</span>
        </>
      }
      above={vetoModes.map(({ key, labelKey }) => (
        <Button
          key={key}
          text={t(labelKey)}
          active={key === mode}
          intent={key === mode ? "primary" : undefined}
          aria-pressed={key === mode}
          onClick={() => setMode(key)}
        />
      ))}
    />
  );
}

/**
 * One row covering every per-player source: pick the player and tick whichever
 * pieces of their info should appear, and the URL follows along.
 */
function PlayerSourceCard({ cabId }: { cabId: string }) {
  const [player, setPlayer] = useState(1);
  const [fields, setFields] = useState<PlayerField[]>(defaultPlayerFields);

  const toggleField = (key: PlayerField) =>
    setFields((prev) =>
      prev.includes(key)
        ? prev.filter((field) => field !== key)
        : inRenderOrder([...prev, key]),
    );

  const href = useHref(
    routableCabSourcePath(cabId, playerSourceStub(player, fields)),
  );

  return (
    <SourceRow
      href={href}
      label={
        <>
          <Person />
          <span>Player</span>
          <NumericInput
            value={player}
            onValueChange={(value) => {
              if (Number.isNaN(value)) return;
              setPlayer(Math.min(Math.max(value, 1), MAX_PLAYERS));
            }}
            min={1}
            max={MAX_PLAYERS}
            clampValueOnBlur
            style={{ width: "3.5em" }}
            aria-label="Player number"
          />
        </>
      }
      above={playerFields.map(({ key, label }) => {
        const active = fields.includes(key);
        // something has to be shown, so the last one standing is held down
        const isLastActive = active && fields.length === 1;
        const button = (
          <Button
            key={key}
            text={label}
            active={active}
            intent={active ? "primary" : undefined}
            disabled={isLastActive}
            aria-pressed={active}
            onClick={() => toggleField(key)}
          />
        );
        return isLastActive ? (
          <Tooltip key={key} content="Include at least one">
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    />
  );
}

function SourceCard({ cabId, source }: { cabId: string; source: CabSource }) {
  const href = useHref(routableCabSourcePath(cabId, source.stub));
  return (
    <SourceRow
      href={href}
      label={
        <>
          {source.icon}
          <span>{source.label}</span>
        </>
      }
    />
  );
}
