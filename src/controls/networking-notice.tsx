import { AnchorButton, Callout } from "@blueprintjs/core";
import { Share } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";

export const NEXT_URL = "https://next.ddr.tools/";

export function NetworkingNotice() {
  const { t } = useIntl();
  return (
    <Callout intent="primary" title={t("controls.networking.title")}>
      <p>{t("controls.networking.description")}</p>
      <AnchorButton
        intent="primary"
        href={NEXT_URL}
        target="_blank"
        rel="noopener noreferrer"
        rightIcon={<Share />}
      >
        next.ddr.tools
      </AnchorButton>
    </Callout>
  );
}
