import {
  Button,
  ButtonGroup,
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
import {
  defaultPickerMode,
  defaultSongMode,
  pickerModes,
  songModes,
  standingsSourceStub,
  type PickerMode,
  type SongMode,
} from "../obs-sources/standings-options";
import { eventSlice } from "../state/event.slice";
import { useAppState } from "../state/store";
import { CAB_SOURCES_PARAM, routableCabSourcePath } from "./copy-obs-source";
import { SourceRow } from "./obs-source-row";

import styles from "./cab-obs-sources.css";

interface CabSource {
  /** path stub which follows `source/` in the url */
  stub: string;
  labelKey: string;
  icon: JSX.Element;
}

/** sources which exist exactly once per cab and take no options */
const perCabSources: CabSource[] = [
  { stub: "title", labelKey: "obsDashboard.sourceTitle", icon: <Font /> },
  {
    stub: "phase",
    labelKey: "obsDashboard.sourcePhase",
    icon: <DiagramTree />,
  },
  { stub: "players", labelKey: "obsDashboard.sourcePlayers", icon: <People /> },
];

const MAX_PLAYERS = 8;

export function CabObsSources() {
  const { t } = useIntl();
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
      title={t("obsDashboard.cabSources")}
      subtitle={t("obsDashboard.cabSourcesHint")}
    >
      <SectionCard>
        {!cab ? (
          <p>{t("obsDashboard.addCabFirst")}</p>
        ) : (
          <>
            <div className={styles.controls}>
              <FormGroup label={t("obsDashboard.cab")} inline>
                <HTMLSelect
                  value={cab.id}
                  onChange={(e) => showCab(e.currentTarget.value)}
                  options={cabs.map((c) => ({ value: c.id, label: c.name }))}
                />
              </FormGroup>
            </div>
            <CardList compact>
              <CardsSourceCard cabId={cab.id} />
              <StandingsSourceCard cabId={cab.id} />
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
          <span>{t("obsDashboard.sourceCards")}</span>
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
 * The gauntlet standings, which say in their url whether pocket and free picks
 * name who picked them, and whether songs nobody has scored yet get a column.
 */
function StandingsSourceCard({ cabId }: { cabId: string }) {
  const { t } = useIntl();
  const [pickers, setPickers] = useState<PickerMode>(defaultPickerMode);
  const [songs, setSongs] = useState<SongMode>(defaultSongMode);
  const href = useHref(
    routableCabSourcePath(cabId, standingsSourceStub({ pickers, songs })),
  );

  return (
    <SourceRow
      href={href}
      label={
        <>
          <Th />
          <span>{t("obsDashboard.sourceStandings")}</span>
        </>
      }
      above={
        <>
          <ButtonGroup>
            {pickerModes.map(({ key, labelKey }) => (
              <Button
                key={key}
                text={t(labelKey)}
                active={key === pickers}
                intent={key === pickers ? "primary" : undefined}
                aria-pressed={key === pickers}
                onClick={() => setPickers(key)}
              />
            ))}
          </ButtonGroup>
          <ButtonGroup>
            {songModes.map(({ key, labelKey }) => (
              <Button
                key={key}
                text={t(labelKey)}
                active={key === songs}
                intent={key === songs ? "primary" : undefined}
                aria-pressed={key === songs}
                onClick={() => setSongs(key)}
              />
            ))}
          </ButtonGroup>
        </>
      }
    />
  );
}

/**
 * One row covering every per-player source: pick the player and tick whichever
 * pieces of their info should appear, and the URL follows along.
 */
function PlayerSourceCard({ cabId }: { cabId: string }) {
  const { t } = useIntl();
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
          <span>{t("obsDashboard.sourcePlayer")}</span>
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
            aria-label={t("obsDashboard.playerNumber")}
          />
        </>
      }
      above={playerFields.map(({ key, labelKey }) => {
        const active = fields.includes(key);
        // something has to be shown, so the last one standing is held down
        const isLastActive = active && fields.length === 1;
        const button = (
          <Button
            key={key}
            text={t(labelKey)}
            active={active}
            intent={active ? "primary" : undefined}
            disabled={isLastActive}
            aria-pressed={active}
            onClick={() => toggleField(key)}
          />
        );
        return isLastActive ? (
          <Tooltip key={key} content={t("obsDashboard.includeAtLeastOne")}>
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
  const { t } = useIntl();
  const href = useHref(routableCabSourcePath(cabId, source.stub));
  return (
    <SourceRow
      href={href}
      label={
        <>
          {source.icon}
          <span>{t(source.labelKey)}</span>
        </>
      }
    />
  );
}
