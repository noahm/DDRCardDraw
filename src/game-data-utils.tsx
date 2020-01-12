import { useContext } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";

export function MetaString({ key }: { key: string }) {
  const { t } = useContext(TranslateContext);
  return <>{t("meta." + key)}</>;
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const { t } = useContext(TranslateContext);
  return <>{t("meta.$abbr." + diffClass)}</>;
}
