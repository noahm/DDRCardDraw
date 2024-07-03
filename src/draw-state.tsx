import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "./unload-handler";
import { requestIdleCallback, cancelIdleCallback } from "./utils/idle-callback";
import { I18NDict } from "./models/SongData";
import i18nData from "./assets/i18n.json";
import { availableGameData, detectedLanguage } from "./utils";
import { IntlProvider } from "./intl-provider";
import { useAppDispatch, useAppState } from "./state/store";
import { loadGameDataByName } from "./state/thunks";
import { drawingsSlice } from "./state/drawings.slice";

interface Props {
  defaultDataSet: string;
  children: ReactNode;
}

function getInitialDataSet(defaultDataName: string) {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("game-")) {
    const targetData = hash.slice(5);
    if (availableGameData.some((d) => d.name === targetData)) {
      return targetData;
    }
  }
  if (
    defaultDataName &&
    availableGameData.some((d) => d.name === defaultDataName)
  ) {
    return defaultDataName;
  }
  return availableGameData[0].name;
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
  const gameData = useAppState((state) => state.gameData.gameData);
  const hasDrawings = useAppState(drawingsSlice.selectors.haveDrawings);
  const dispatch = useAppDispatch();
  useEffect(() => {
    const idleHandle = requestIdleCallback(() =>
      dispatch(loadGameDataByName(getInitialDataSet(props.defaultDataSet))),
    );
    return () => cancelIdleCallback(idleHandle);
  }, [dispatch, props.defaultDataSet]);

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
