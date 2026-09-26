import { useMemo } from "react";
import { useIntl as useReactIntl } from "react-intl";

type Primitive = string | number | Date | boolean | undefined | null;

export function useIntl() {
  const { formatMessage, messages } = useReactIntl();
  return useMemo(
    () => ({
      formatMessage,
      messageExists: (id: string) => {
        return !!messages[id];
      },
      t: (
        id: string,
        values?: Record<string, Primitive>,
        defaultMessage?: string,
      ) => formatMessage({ id, defaultMessage }, values),
    }),
    [formatMessage, messages],
  );
}
