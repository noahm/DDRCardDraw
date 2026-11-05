import { DateInput } from "@mantine/dates";
import parse from "date-fns/parse";
import format from "date-fns/format";
import { useIntl } from "../hooks/useIntl";
import { useConfigState, useUpdateConfig } from "../state/hooks";

const dateFormat = "yyyy-MM-dd";
export default function ReleaseDateFilterControl(props: {
  mostRecentRelease: string;
}) {
  const { t } = useIntl();
  const cutoffDate = useConfigState((s) => s.cutoffDate);
  const updateState = useUpdateConfig();

  const reference = new Date();
  const maxDate = parse(props.mostRecentRelease, dateFormat, reference);
  const minDate = parse("2000-01-01", dateFormat, reference);

  return (
    <DateInput
      label={t("controls.releaseHeader")}
      mb="md"
      valueFormat="YYYY-MM-DD"
      value={cutoffDate || props.mostRecentRelease}
      onChange={(newDate) => {
        if (!newDate) {
          updateState({ cutoffDate: "" });
          return;
        }
        updateState({ cutoffDate: format(new Date(newDate), dateFormat) });
      }}
      placeholder={t("controls.releaseInputPlaceholder", { dateFormat })}
      maxDate={maxDate}
      minDate={minDate}
    />
  );
}
