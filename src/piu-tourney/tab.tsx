import { PickedMatch } from "../matches";
import { PiuTourneyGated } from "./components";
import { PiuMatchPicker } from "./matches";

/**
 * Everything the New Draw dialog needs for the tourney maker tab, behind one
 * default export so the dialog can pull it in with a single lazy import.
 *
 * This module and its imports are the only reach into @supabase/supabase-js,
 * which keeps that dependency out of the main bundle.
 */
export default function PiuTourneyTab(props: {
  onPickMatch: (match: PickedMatch) => void;
}) {
  return (
    <PiuTourneyGated>
      <PiuMatchPicker onPickMatch={props.onPickMatch} />
    </PiuTourneyGated>
  );
}
