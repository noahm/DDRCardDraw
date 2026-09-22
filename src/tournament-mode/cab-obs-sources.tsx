import {
  Button,
  NativeSelect,
  NumberInput,
  Stack,
  Tooltip,
} from "@mantine/core";
import {
  IconBinaryTree,
  IconStack2,
  IconTable,
  IconTypography,
  IconUser,
  IconUsers,
  IconVideo,
} from "@tabler/icons-react";
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
import { Section } from "../common-components/section";

import styles from "./cab-obs-sources.css";

interface CabSource {
  /** path stub which follows `source/` in the url */
  stub: string;
  labelKey: string;
  icon: JSX.Element;
}

/** sources which exist exactly once per cab and take no options */
const perCabSources: CabSource[] = [
  {
    stub: "title",
    labelKey: "obsDashboard.sourceTitle",
    icon: <IconTypography size={16} />,
  },
  {
    stub: "phase",
    labelKey: "obsDashboard.sourcePhase",
    icon: <IconBinaryTree size={16} />,
  },
  {
    stub: "standings",
    labelKey: "obsDashboard.sourceStandings",
    icon: <IconTable size={16} />,
  },
  {
    stub: "players",
    labelKey: "obsDashboard.sourcePlayers",
    icon: <IconUsers size={16} />,
  },
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
      collapse={{ opened: isOpen, onToggle: toggleOpen }}
      icon={<IconVideo size={20} />}
      title={t("obsDashboard.cabSources")}
      subtitle={t("obsDashboard.cabSourcesHint")}
    >
      {!cab ? (
        <p>{t("obsDashboard.addCabFirst")}</p>
      ) : (
        <>
          <div className={styles.controls}>
            <NativeSelect
              label={t("obsDashboard.cab")}
              value={cab.id}
              onChange={(e) => showCab(e.currentTarget.value)}
              data={cabs.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <Stack gap="xs">
            <CardsSourceCard cabId={cab.id} />
            {perCabSources.map((source) => (
              <SourceCard key={source.stub} cabId={cab.id} source={source} />
            ))}
            <PlayerSourceCard cabId={cab.id} />
          </Stack>
        </>
      )}
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
          <IconStack2 size={16} />
          <span>{t("obsDashboard.sourceCards")}</span>
        </>
      }
      above={vetoModes.map(({ key, labelKey }) => (
        <Button
          key={key}
          size="compact-sm"
          variant={key === mode ? "filled" : "default"}
          aria-pressed={key === mode}
          onClick={() => setMode(key)}
        >
          {t(labelKey)}
        </Button>
      ))}
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
          <IconUser size={16} />
          <span>{t("obsDashboard.sourcePlayer")}</span>
          <NumberInput
            size="xs"
            value={player}
            onChange={(value) => {
              if (typeof value !== "number" || Number.isNaN(value)) return;
              setPlayer(Math.min(Math.max(value, 1), MAX_PLAYERS));
            }}
            min={1}
            max={MAX_PLAYERS}
            clampBehavior="blur"
            allowDecimal={false}
            w="4.5em"
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
            size="compact-sm"
            variant={active ? "filled" : "default"}
            disabled={isLastActive}
            aria-pressed={active}
            onClick={() => toggleField(key)}
          >
            {t(labelKey)}
          </Button>
        );
        return isLastActive ? (
          <Tooltip key={key} label={t("obsDashboard.includeAtLeastOne")}>
            {/* a disabled button fires no pointer events to show the tip on */}
            <span>{button}</span>
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
