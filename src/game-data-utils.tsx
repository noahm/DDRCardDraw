import { useIntl } from "./hooks/useIntl";

export function getMetaString(t: (key: string) => string, key: string) {
  return t("meta." + key);
}

export function MetaString({ key }: { key: string }) {
  const { t } = useIntl();
  return <>{getMetaString(t, key)}</>;
}

export function getDiffClass(t: (key: string) => string, diffClassKey: string) {
  return t("meta.$abbr." + diffClassKey);
}

interface AbbrProps {
  diffClass: string;
}

export function AbbrDifficulty({ diffClass }: AbbrProps) {
  const { t } = useIntl();
  return <>{getDiffClass(t, diffClass)}</>;
}
