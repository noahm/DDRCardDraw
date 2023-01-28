import { IntlProvider as UpstreamProvider } from "react-intl";
import { PropsWithChildren, useMemo } from "react";
import { flattenedKeys, ValueOrObj } from "./utils";

interface Props {
  locale: string;
  translations: Record<string, ValueOrObj<string>>;
  mergeTranslations?: Record<string, string | Record<string, string>>;
}

export function IntlProvider({
  locale,
  translations,
  mergeTranslations,
  children,
}: PropsWithChildren<Props>) {
  const messages = useMemo(() => {
    const ret: Record<string, string> = {};
    for (const [k, v] of flattenedKeys(translations)) {
      ret[k] = v;
    }
    if (mergeTranslations) {
      for (const [k, v] of flattenedKeys(mergeTranslations)) {
        ret[`meta.${k}`] = v;
      }
    }
    return ret;
  }, [translations, mergeTranslations]);

  return (
    <UpstreamProvider locale={locale} messages={messages}>
      {children}
    </UpstreamProvider>
  );
}
