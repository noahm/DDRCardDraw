import { useContext } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";

export function MetaString({ field }: { field: string }) {
  const { t } = useContext(TranslateContext);
  return <>{t("meta." + field)}</>;
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const { t } = useContext(TranslateContext);
  return <>{t("meta.$abbr." + diffClass)}</>;
}
