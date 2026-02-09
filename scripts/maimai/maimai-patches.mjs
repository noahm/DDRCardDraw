/**
 * @file maimai-patch.mjs
 * Fields here will override/fill missing song info or chart info
 */
// Song Patch Example
// "エンジェル ドリーム" :{
//   title: "test",
//   artist: "test",
//   bpm: 100,
//   imageName: "testjacket.png",
//   version: "test",                  -> Must match existing folder values exactly or folder filter will not work with song
//   charts: [
//     {
//       index: 0,                     -> Adjust value to change which Chart to patch
//       style: "single",
//       diffClass: "master",          -> "basic, advanced, expert, master, remaster, utage"
//       lvl: 1,                       -> Levels 1.0 - 15.0
//       extras: "std"                 -> std | dx
//     }
//   ]
// }

// https://silentblue.remywiki.com/
export const MAIMAI_PATCH = {
  ぽっぴっぽー: {
    artist: "Lamaze P",
  },
  ダブルラリアット: {
    bpm: 138,
  },
  洗脳: {
    bpm: 125,
  },
  "チュルリラ・チュルリラ・ダッダッダ！": {
    bpm: 220,
  },
  エイリアンエイリアン: {
    bpm: 152,
  },
  "Seyana. ～何でも言うことを聞いてくれるアカネチャン～": {
    bpm: 144,
  },
  "マイオドレ！舞舞タイム": {
    bpm: 183,
  },
  テレキャスタービーボーイ: {
    bpm: 182,
  },
  アンビバレンス: {
    bpm: 187,
  },
  ラグトレイン: {
    bpm: 147,
  },
  アカツキアライヴァル: {
    bpm: 125,
  },
  ヒトガタ: {
    bpm: 150,
  },
  スカーレット警察のゲットーパトロール24時: {
    bpm: 160,
  },
  さくゆいたいそう: {
    bpm: 160,
  },
  のじゃロリック: {
    bpm: 160,
  },
  匿名M: {
    bpm: 140,
  },
  "Ultimate taste": {
    bpm: 150,
  },
  メズマライザー: {
    bpm: 185,
  },
  ありきたりな恋の歌: {
    bpm: 180,
  },
  "エンジェル ドリーム": {
    bpm: 180,
  },
};
