import { useAtomValue } from "jotai";
import { ReactNode, useMemo } from "react";
import { IntlProvider as UpstreamProvider } from "react-intl";
import translations from "./assets/i18n.json";
import { I18NDict } from "./models/SongData";
import { gameDataAtom } from "./state/game-data.atoms";
import { detectedLanguage, flattenedKeys } from "./utils";

const FALLBACK_LOCALE = "en";

const typedTranslations = translations as Record<string, I18NDict>;

export function IntlProvider({ children }: { children: ReactNode }) {
  const gameSpecificTranslations = useAtomValue(gameDataAtom)?.i18n;

  const messages = useMemo(() => {
    const ret: Record<string, string> = {};
    for (const [k, v] of flattenedKeys(typedTranslations[FALLBACK_LOCALE])) {
      ret[k] = v;
    }
    for (const [k, v] of flattenedKeys(typedTranslations[detectedLanguage])) {
      ret[k] = v;
    }
    if (gameSpecificTranslations) {
      for (const [k, v] of flattenedKeys(
        gameSpecificTranslations[FALLBACK_LOCALE],
      )) {
        ret[`meta.${k}`] = v;
      }
      for (const [k, v] of flattenedKeys(
        gameSpecificTranslations[detectedLanguage],
      )) {
        ret[`meta.${k}`] = v;
      }
    }
    return ret;
  }, [gameSpecificTranslations]);

  return (
    <UpstreamProvider locale={detectedLanguage} messages={messages}>
      {children}
    </UpstreamProvider>
  );
}
