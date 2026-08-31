import { ReactNode, useEffect } from "react";
import { UnloadHandler } from "../unload-handler";
import {
  requestIdleCallback,
  cancelIdleCallback,
} from "../utils/idle-callback";
import i18nData from "../assets/i18n.json";
import { availableGameData, detectedLanguage } from "../utils";
import { I18NDict } from "../models/SongData";
import { ApplyDefaultConfig } from "../apply-default-config";
import { IntlProvider } from "../intl-provider";
import { shallow } from "zustand/shallow";
import { useDrawState } from "./store";

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

export function DrawStateManager(props: Props) {
  const [gameData, hasDrawings, loadGameData] = useDrawState(
    (state) => [state.gameData, !!state.drawings.length, state.loadGameData],
    shallow,
  );
  useEffect(() => {
    const idleHandle = requestIdleCallback(() =>
      loadGameData(getInitialDataSet(props.defaultDataSet)),
    );
    return () => cancelIdleCallback(idleHandle);
  }, [loadGameData, props.defaultDataSet]);

  return (
    <IntlProvider
      locale={detectedLanguage}
      translations={i18nData as Record<string, I18NDict>}
      mergeTranslations={gameData?.i18n}
    >
      <ApplyDefaultConfig
        defaults={gameData?.defaults}
        granularResolution={gameData?.meta.granularTierResolution}
      />
      <UnloadHandler confirmUnload={hasDrawings} />
      {props.children}
    </IntlProvider>
  );
}
