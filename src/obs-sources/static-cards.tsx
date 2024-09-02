import { useSearchParams } from "react-router-dom";
import { availableGameData } from "../utils";
import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { gameDataAtom } from "../state/game-data.atoms";
import { gameDataSlice } from "../state/game-data.slice";
import { useAppDispatch } from "../state/store";
import { GameData } from "../models/SongData";
import { getDrawnChart } from "../card-draw";
import { RawChartList } from "../drawn-set";

export function StaticCards() {
  const [searchParams] = useSearchParams();
  const game = searchParams.get("game");
  if (!game) {
    return "must specify game param";
  }
  if (!availableGameData.some((data) => data.name === game)) {
    return `no available game known by stub ${game}. use one of ${availableGameData.map((data) => data.name).join(", ")}`;
  }
  const charts = searchParams.getAll("chart");
  if (!charts.length) {
    return "must specify charts with the chart param";
  }
  return <StaticCardsLoader game={game} charts={charts} />;
}

function StaticCardsLoader(props: { game: string; charts: string[] }) {
  const gameData = useAtomValue(gameDataAtom);
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(
      gameDataSlice.actions.selectGameData({
        dataSetName: props.game,
        dataType: "stock",
      }),
    );
  }, [dispatch, props.game]);
  if (!gameData) {
    return null;
  }
  return <StaticCardsPresentation gameData={gameData} charts={props.charts} />;
}

function StaticCardsPresentation(props: {
  gameData: GameData;
  charts: string[];
}) {
  const cardDatas = props.charts
    .map((chartString) => {
      const [songId, chartId] = chartString.split(",");
      const song = props.gameData.songs.find((s) => s.saIndex === songId);
      if (!song) return null;
      const chart = song.charts[+chartId];
      if (!chart) return null;
      return getDrawnChart(props.gameData, song, chart);
    })
    .filter((chart) => chart !== null);
  return <RawChartList charts={cardDatas} />;
}
