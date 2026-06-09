/**
 * @file maimai-patch.mjs
 * Fields here will override/fill missing song info or chart info.
 * Overriding info for individual sheets is not supported currently.
 */

import { release } from "node:process";

// https://silentblue.remywiki.com/
export const MAIMAI_PATCH = {
  ぽっぴっぽー: {
    artist: "Lamaze P",
  },
  ダブルラリアット: {
    bpm: 138,
    releaseDate: "2014-09-18",
  },
  洗脳: {
    bpm: 125,
    releaseDate: "2016-07-28",
  },
  "チュルリラ・チュルリラ・ダッダッダ！": {
    bpm: 220,
    releaseDate: "2017-01-24",
  },
  エイリアンエイリアン: {
    bpm: 152,
    releaseDate: "2017-11-21",
  },
  "Seyana. ～何でも言うことを聞いてくれるアカネチャン～": {
    bpm: 144,
    releaseDate: "2018-06-21",
  },
  "マイオドレ！舞舞タイム": {
    bpm: 183,
    releaseDate: "2020-09-17",
  },
  テレキャスタービーボーイ: {
    bpm: 182,
    releaseDate: "2021-09-16",
  },
  アンビバレンス: {
    bpm: 187,
    releaseDate: "2021-09-22",
  },
  ラグトレイン: {
    bpm: 147,
    releaseDate: "2022-02-25",
  },
  アカツキアライヴァル: {
    bpm: 125,
    releaseDate: "2022-02-25",
  },
  ヒトガタ: {
    bpm: 150,
    releaseDate: "2022-06-10",
  },
  スカーレット警察のゲットーパトロール24時: {
    bpm: 160,
    releaseDate: "2022-09-15",
  },
  さくゆいたいそう: {
    bpm: 160,
    releaseDate: "2023-09-14",
  },
  のじゃロリック: {
    bpm: 160,
    releaseDate: "2024-03-21 ",
  },
  匿名M: {
    bpm: 140,
    releaseDate: "2024-03-21",
  },
  "Ultimate taste": {
    bpm: 150,
    releaseDate: "2024-09-12",
  },
  メズマライザー: {
    bpm: 185,
    releaseDate: "2025-03-13",
  },
  ありきたりな恋の歌: {
    bpm: 180,
    releaseDate: "2025-08-08",
  },
  "エンジェル ドリーム": {
    bpm: 180,
  },
};
