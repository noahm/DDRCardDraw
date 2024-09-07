import { useAtomValue } from "jotai";
import { ReactNode, useMemo } from "react";
import { IntlProvider as UpstreamProvider } from "react-intl";
import translations from "./assets/i18n.json";
import { I18NDict } from "./models/SongData";
import { detectedLanguage, flattenedKeys } from "./utils";
import { stockDataCache } from "./state/game-data.atoms";

const FALLBACK_LOCALE = "en";

const typedTranslations = translations as Record<string, I18NDict>;

export function IntlProvider({ children }: { children: ReactNode }) {
  const allLoadedData = useAtomValue(stockDataCache);

  const messages = useMemo(() => {
    const ret: Record<string, string> = {};
    for (const [k, v] of flattenedKeys(typedTranslations[FALLBACK_LOCALE])) {
      ret[k] = v;
    }
    for (const [k, v] of flattenedKeys(typedTranslations[detectedLanguage])) {
      ret[k] = v;
    }
    for (const [gameKey, data] of Object.entries(allLoadedData)) {
      const gameSpecificTranslations = data.i18n;
      if (gameSpecificTranslations) {
        const keyPrefix = `game.${gameKey}.`;
        for (const [k, v] of flattenedKeys(
          gameSpecificTranslations[FALLBACK_LOCALE],
        )) {
          ret[keyPrefix + k] = v;
        }
        for (const [k, v] of flattenedKeys(
          gameSpecificTranslations[detectedLanguage],
        )) {
          ret[keyPrefix + k] = v;
        }
      }
    }
    return ret;
  }, [allLoadedData]);

  return (
    <UpstreamProvider locale={detectedLanguage} messages={messages}>
      {children}
    </UpstreamProvider>
  );
}
