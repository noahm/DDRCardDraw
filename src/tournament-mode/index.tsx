import { Outlet, useParams } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { Header } from "../header";
import { urqlClient } from "../startgg-gql";
import { CabManagement } from "./cab-management";
import { MainView } from "./main-view";
import { RoomProvider } from "../jazz/room-context";

export function TournamentModeAppShell() {
  const params = useParams<"roomName">();
  if (!params.roomName) {
    return null;
  }
  return (
    <RoomProvider roomName={params.roomName}>
      <UrqlProvider value={urqlClient}>
        <Header />
        <Outlet />
      </UrqlProvider>
    </RoomProvider>
  );
}

export function TournamentModeAppMain() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "stretch",
        flex: "1 1 0px",
        overflow: "hidden",
      }}
    >
      <CabManagement />
      <MainView />
    </div>
  );
}
