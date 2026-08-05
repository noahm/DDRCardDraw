import { AnchorButton, Callout } from "@blueprintjs/core";
import { Share } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";

export const NEXT_URL = "https://next.ddr.tools/";

/** Warns that the peer-to-peer network features are on their way out */
export function NetworkingNotice() {
  const { t } = useIntl();
  return (
    <Callout
      intent="warning"
      title={t("controls.networking.title")}
      style={{ marginBottom: "15px" }}
    >
      <p>{t("controls.networking.description")}</p>
      <AnchorButton
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
