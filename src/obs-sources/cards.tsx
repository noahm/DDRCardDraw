import { useParams, useSearchParams } from "react-router-dom";
import { ChartList } from "../drawn-set";
import { useAppState } from "../state/store";
import { DrawingProvider } from "../drawing-context";
import { PlainDrawnSetGroup } from "../drawn-set-group";
import { HideVetosOverrideProvider } from "../state/hooks";
import { hidesVetos, toVetoMode, VETOS_PARAM } from "./card-options";
/**
 * The cards of whichever match a cab is running.
 *
 * `?vetos=show` or `?vetos=hide` settles whether banned charts appear here
 * regardless of what the room's own setting says; without it the room decides,
 * as it always has. `src/obs-sources/card-options.ts` covers why.
 *
 * @todo figure out how/if we can assign/view sub-draws here?
 */
export function CabCards() {
  const params = useParams<"roomName" | "cabId">();
  const [searchParams] = useSearchParams();
  const drawingId = useAppState((s) => s.event.cabs[params.cabId!].activeMatch);
  const hideVetos = hidesVetos(toVetoMode(searchParams.get(VETOS_PARAM)));
  if (!drawingId) {
    return null;
  }
  return (
    <HideVetosOverrideProvider value={hideVetos}>
      {typeof drawingId === "string" ? (
        <PlainDrawnSetGroup drawingId={drawingId} />
      ) : (
        <DrawingProvider drawingId={drawingId}>
          <ChartList />
        </DrawingProvider>
      )}
    </HideVetosOverrideProvider>
  );
}
