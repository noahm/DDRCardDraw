import { Button, Intent, Navbar } from "@blueprintjs/core";
import { Header } from "../header";
import { FormattedMessage } from "react-intl";
import { NewLayers } from "@blueprintjs/icons";
import { ConfigSelect } from "../controls";
import { useState } from "react";
import { createDraw } from "../state/thunks";
import { useAppDispatch } from "../state/store";
import { useNavigate } from "react-router-dom";

export function PreviewModeHeader() {
  const heading = <Navbar.Heading>Event Preview</Navbar.Heading>;
  return <Header heading={heading} controls={<PreviewModeControls />} />;
}

function getConfigId() {
  const params = new URLSearchParams(location.search);
  return params.get("configId");
}

function PreviewModeControls() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(getConfigId);
  function handleChangeConfig(nextId: string) {
    setSelected(nextId);
    navigate({ search: "?configId=" + nextId }, { replace: true });
  }
  return (
    <>
      <ConfigSelect selectedId={selected} onChange={handleChangeConfig} />
      <Button
        onClick={() =>
          dispatch(
            createDraw(
              {
                meta: {
                  type: "simple",
                  title: "Sample Draw",
                  players: ["P1", "P2"],
                },
              },
              selected!,
            ),
          )
        }
        icon={<NewLayers />}
        intent={Intent.PRIMARY}
        disabled={!selected}
      >
        <FormattedMessage id="draw" />
      </Button>
    </>
  );
}
