import { MenuDivider, MenuItem } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { FormattedMessage } from "react-intl";
import { useDataSets } from "./hooks/useDataSets";

export function VersionSelect() {
  const { available, current, loadData } = useDataSets();

  return (
    <>
      <MenuDivider title={<FormattedMessage id="dataSource" />} />
      {available.map(({ name, display }) => (
        <MenuItem
          key={name}
          text={display}
          active={name === current.name}
          onClick={() => loadData(name)}
          icon={name === current.name ? IconNames.SELECTION : IconNames.CIRCLE}
        />
      ))}
    </>
  );
}
