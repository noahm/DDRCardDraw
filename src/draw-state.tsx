import { ReactNode } from "react";
import { UnloadHandler } from "./unload-handler";
import { I18NDict } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { detectedLanguage } from "./utils";
import { IntlProvider } from "./intl-provider";
import { useAppState } from "./state/store";
import { drawingsSlice } from "./state/drawings.slice";
import { useAtomValue } from "jotai";
import { gameDataAtom } from "./state/game-data.atoms";

interface Props {
  defaultDataSet: string;
  children: ReactNode;
}

// function writeDataSetToUrl(game: string) {
//   const nextHash = `game-${game}`;
//   if ("#" + nextHash !== window.location.hash) {
//     const nextUrl = new URL(window.location.href);
//     nextUrl.hash = encodeURIComponent(nextHash);
//     window.history.replaceState(undefined, "", nextUrl);
//   }
// }

export function DrawStateManager(props: Props) {
  const gameData = useAtomValue(gameDataAtom);
  const hasDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  // const dispatch = useAppDispatch();
  // useEffect(() => {
  //   const idleHandle = requestIdleCallback(() =>
  //     dispatch(
  //       gameDataSlice.actions.selectGameData({
  //         dataSetName: getInitialDataSet(props.defaultDataSet),
  //         dataType: "stock",
  //       }),
  //     ),
  //   );
  //   return () => cancelIdleCallback(idleHandle);
  // }, [dispatch, props.defaultDataSet]);

  return (
    <IntlProvider
      locale={detectedLanguage}
      translations={i18nData as Record<string, I18NDict>}
      mergeTranslations={gameData?.i18n}
    >
      <UnloadHandler confirmUnload={hasDrawings} />
      {props.children}
    </IntlProvider>
  );
}
