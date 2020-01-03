import { useContext } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";

interface Props {
  difficultyClass: string;
}

export function AbbrDifficulty({ difficultyClass }: Props) {
  const { t } = useContext(TranslateContext);
  return t("meta.$abbr." + difficultyClass);
}
