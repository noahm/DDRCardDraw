import { useIntl } from "./hooks/useIntl";
import { GameData, I18NDict } from "./models/SongData";

export function MetaString({ key }: { key: string }) {
  const { t } = useIntl();
  return <>{t("meta." + key)}</>;
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const { t } = useIntl();
  return <>{t("meta.$abbr." + diffClass)}</>;
}

export function getDiffAbbr(gameData: GameData, diffClass: string) {
  return ((gameData.i18n.en as I18NDict)["$abbr"] as I18NDict)[
    diffClass
  ] as string;
}
