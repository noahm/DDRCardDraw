import { Header } from "../header";
import { Outlet } from "react-router-dom";
import { ClassicModeContext } from "../common-components/app-mode";
import { RoomProvider } from "../jazz/room-context";

// Classic mode uses the fixed roomName "classic" — Jazz persists the room in
// localStorage automatically (guestMode), so no explicit localStorage manager
// is needed.  The room is created on first visit and reused thereafter.
export function ClassicModeShell() {
  return (
    <RoomProvider roomName="classic">
      <ClassicModeContext>
        <Header />
        <Outlet />
      </ClassicModeContext>
    </RoomProvider>
  );
}
