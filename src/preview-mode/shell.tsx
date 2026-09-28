import { Outlet, useLoaderData } from "react-router-dom";
import { Provider as ReduxProvider } from "react-redux";
import { getPartykitState } from "../party/host";
import { useMemo } from "react";
import { createClientStore } from "../state/store";
import { PreviewModeHeader } from "./header";
import { DrawingList } from "../drawing-list";
import { ClassicModeContext } from "../common-components/app-mode";
import { useIntl } from "../hooks/useIntl";

async function loader(roomName: string | undefined) {
  if (!roomName) {
    return;
  }
  const state = await getPartykitState(roomName);
  state.drawings.entities = {};
  state.drawings.ids = [];
  return state;
}

export function PreviewShell() {
  const initialState = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const store = useMemo(() => createClientStore(initialState), [initialState]);
  return (
    <ReduxProvider store={store}>
      <Outlet />
    </ReduxProvider>
  );
}

PreviewShell.loader = loader;

export function PreviewView() {
  const { t } = useIntl();
  return (
    <ClassicModeContext>
      <PreviewModeHeader />
      <DrawingList introString={t("hero.previewDesc")} />
    </ClassicModeContext>
  );
}
