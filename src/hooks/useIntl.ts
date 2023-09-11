import { useMemo } from "react";
import { useIntl as useReactIntl } from "react-intl";

type Primitive = string | number | Date | boolean | undefined | null;

export function useIntl() {
  const { formatMessage } = useReactIntl();
  return useMemo(
    () => ({
      t: (
        id: string,
        values?: Record<string, Primitive>,
        defaultMessage?: string,
      ) => formatMessage({ id, defaultMessage }, values),
    }),
    [formatMessage],
  );
}
