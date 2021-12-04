import { HTMLSelect } from "@blueprintjs/core";
import { useDataSets } from "./hooks/useDataSets";
import { useIntl } from "./hooks/useIntl";

export function VersionSelect() {
  const { t } = useIntl();
  const { current, available, loadData } = useDataSets();
  return (
    <HTMLSelect
      value={current.name}
      onChange={(e) => loadData(e.currentTarget.value)}
    >
      {available.map((d) => (
        <option value={d.name} key={d.name}>
          {d.display}
        </option>
      ))}
    </HTMLSelect>
  );
}
