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
 * `?vetos=show` or `?vetos=hide` is the whole of what decides whether banned
 * charts appear here — every other client reads its own local setting, and an
 * OBS browser has nobody to set one. Without the param they show.
 * `src/obs-sources/card-options.ts` covers why.
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
