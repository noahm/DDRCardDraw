import { useIntl } from "./hooks/useIntl";

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
