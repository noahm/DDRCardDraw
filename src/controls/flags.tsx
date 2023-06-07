import { useRecoilState } from "recoil";
import { flags as flagsAtom } from "../config-state";
import { useDrawState } from "../draw-state";
import { Checkbox, FormGroup } from "@blueprintjs/core";
import { useIntl } from "../hooks/useIntl";

export function Flags() {
  const { t } = useIntl();
  const flags = useDrawState((s) => s.gameData?.meta.flags);
  const dataSetName = useDrawState((s) => s.dataSetName);
  const [selectedFlags, setFlags] = useRecoilState(flagsAtom);
  if (!flags?.length) {
    return null;
  }
  return (
    <FormGroup label={t("include")}>
      {flags.map((key) => (
        <Checkbox
          key={`${dataSetName}:${key}`}
          label={t("meta." + key)}
          value={key}
          checked={selectedFlags.has(key)}
          onChange={() =>
            setFlags((prev) => {
              const newFlags = new Set(prev);
              if (newFlags.has(key)) {
                newFlags.delete(key);
              } else {
                newFlags.add(key);
              }
              return newFlags;
            })
          }
        />
      ))}
    </FormGroup>
  );
}
