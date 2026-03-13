import { Provider as ReduxProvider } from "react-redux";
import { Outlet, useParams } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { Header } from "../header";
import { urqlClient } from "../startgg-gql";
import { CabManagement } from "./cab-management";
import { MainView } from "./main-view";
import { createClientStore } from "../state/store";
import { useMemo } from "react";
// Jazz: replaces PartySocketManager + the server-side PartyKit room
import { JazzSyncManager } from "../jazz/sync-manager";

export function TournamentModeAppShell() {
  const params = useParams<"roomName">();
  const store = useMemo(() => createClientStore(), []);
  if (!params.roomName) {
    return null;
  }
  return (
    <ReduxProvider store={store}>
      {/*
       * JazzSyncManager replaces <PartySocketManager roomName={roomName}>.
       *
       * What changed:
       *  - No PartyKit server process needed — Jazz Cloud handles sync
       *  - Room state is a Jazz CoValue (CRDTs) instead of Redux-over-WebSocket
       *  - Room is identified by a Jazz CoValue ID (stored in localStorage by
       *    human-readable roomName); shareable via createInviteLink()
       *  - Redux store is still used for local component state; Jazz keeps it
       *    in sync across all connected browsers automatically
       */}
      <JazzSyncManager roomName={params.roomName}>
        <UrqlProvider value={urqlClient}>
          <Header />
          <Outlet />
        </UrqlProvider>
      </JazzSyncManager>
    </ReduxProvider>
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
