import { IntlProvider as UpstreamProvider } from "react-intl";
import { PropsWithChildren, useMemo } from "react";
import { flattenedKeys } from "./utils";
import { I18NDict } from "./models/SongData";

const FALLBACK_LOCALE = "en";

interface Props {
  locale: string;
  translations: Record<string, I18NDict>;
  mergeTranslations?: Record<string, I18NDict>;
}

export function IntlProvider({
  locale,
  translations,
  mergeTranslations,
  children,
}: PropsWithChildren<Props>) {
  const messages = useMemo(() => {
    const ret: Record<string, string> = {};
    for (const [k, v] of flattenedKeys(translations[FALLBACK_LOCALE])) {
      ret[k] = v;
    }
    for (const [k, v] of flattenedKeys(translations[locale])) {
      ret[k] = v;
    }
    if (mergeTranslations) {
      for (const [k, v] of flattenedKeys(mergeTranslations[FALLBACK_LOCALE])) {
        ret[`meta.${k}`] = v;
      }
      for (const [k, v] of flattenedKeys(mergeTranslations[locale])) {
        ret[`meta.${k}`] = v;
      }
    }
    return ret;
  }, [translations, mergeTranslations, locale]);

  return (
    <UpstreamProvider locale={locale} messages={messages}>
      {children}
    </UpstreamProvider>
  );
}
