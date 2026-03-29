import { Outlet, useParams } from "react-router-dom";
import { PreviewModeHeader } from "./header";
import { DrawingList } from "../drawing-list";
import { ClassicModeContext } from "../common-components/app-mode";
import { useIntl } from "../hooks/useIntl";
import { RoomProvider } from "../jazz/room-context";

// Preview mode loads the same Jazz room as tournament mode for the given
// roomName (the room ID is stored in localStorage by the tournament operator).
export function PreviewShell() {
  const params = useParams<"roomName">();
  if (!params.roomName) return null;
  return (
    <RoomProvider roomName={params.roomName}>
      <Outlet />
    </RoomProvider>
  );
}

// No async loader needed — Jazz loads the room reactively.
PreviewShell.loader = async (_roomName: string | undefined) => null;

export function PreviewView() {
  const { t } = useIntl();
  return (
    <ClassicModeContext>
      <PreviewModeHeader />
      <DrawingList introString={t("hero.previewDesc")} />
    </ClassicModeContext>
  );
}
