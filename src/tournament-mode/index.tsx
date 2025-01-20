import { Provider as ReduxProvider } from "react-redux";
import { useParams } from "react-router-dom";
import { Provider as UrqlProvider } from "urql";
import { Header } from "../header";
import { PartySocketManager } from "../party/client";
import { urqlClient } from "../startgg-gql";
import { CabManagement } from "./cab-management";
import { MainView } from "./main-view";
import { store } from "../state/store";

export function TournamentModeApp() {
  const params = useParams<"roomName">();
  if (!params.roomName) {
    return null;
  }
  return (
    <ReduxProvider store={store}>
      <PartySocketManager roomName={params.roomName}>
        <UrqlProvider value={urqlClient}>
          <Header />
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
        </UrqlProvider>
      </PartySocketManager>
    </ReduxProvider>
  );
}
