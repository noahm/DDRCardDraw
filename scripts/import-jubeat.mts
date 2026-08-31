import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import task from "tasuku";

import {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
  sortSongs,
} from "./utils.mts";
import { tryGetMetaFromRemy } from "./scraping/remy.mts";
import type { GameData, Song } from "../src/models/SongData.ts";
import { SongImporter } from "./scraping/eagate-jubeat.mts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileName = "jubeat-beyondave.json";

const licensedSongUrl =
  "https://p.eagate.573.jp/game/jubeat/beyond/music/index.html";
const originalSongUrl =
  "https://p.eagate.573.jp/game/jubeat/beyond/music/original.html";

/** Songs that need unlock on current event (cannot be transmitted) */
const currentEventsSongs = [
  // #region LIGHT CHAT (Ave.)
  "id25876574", // Explore Every Ave.
  "id32090076", // Flying soda
  "id46909617", // Victory of the Century
  "id92673621", // Reincarnation Of Dead Petal
  "id35523478", // Cranberry
  "id74282345", // ZIGZAG COWBOY
  "id58073193", // Mr.REAPER
  "id87851128", // Liar×Girl
  "id38542207", // †渚のリベンジΣ脈あり!?バケェ～ション†
  "id57051826", // Time Lapse
  "id33392320", // Elysion ex machina
  "id15485575", // brown hawk owl
  "id18041879", // Lost Dream
  "id71588407", // Crackpot Evangelist
  // #endregion LIGHT CHAT (Ave.)

  // #region LIGHT CHAT (beyond the Ave.)
  "id36485019", //beyond the Ave.
  "id96036015", // 幻想リフレクト
  "id36601796", // IGNITE THE IRON HEART
  "id53850808", // アヤノトリ
  "id64931876", // Krack Your Soul
  "id64693650", // Fate
  "id83854454", // Croissant
  "id38472017", // Prowler
  "id24950642", // pray nightly
  "id86597057", // Thanatøs
  "id21264849", // カラフルミニッツ [ 2 ]
  "id83370747", // New Decade [ 2 ]
  // #endregion LIGHT CHAT (beyond the Ave.)

  // #region SMITH STREET
  "id92335318", // Snow Falcon
  "id72932988", // CUTIE
  "id92382121", // Yelling
  "id41928193", // Eternal Dream
  "id35446287", // Beyond The Earth
  "id30740339", // voxel star arise
  "id80488131", // AIR RAID FROM THA UNDAGROUND [ 2 ]
  "id53678708", // Icicle Cube
  "id58910938", // ウラシブヤのテーマ
  "id75652081", // break through the clouds
  "id16154164", // Crescive Volt
  "id49128024", // Never Look Back in Sorrow [ 2 ]
  // #endregion SMITH STREET

  // #region いちかのごちゃまぜMix UP！ → BONUS TUNE
  "id72290118", // Dance With The Dead
  "id81466028", // Metamorphic
  "id33477488", // Love 2 Shuffle
  "id63528953", // MONOLITH
  "id95813126", // VOLAQUAS
  // #endregion いちかのごちゃまぜMix UP！ → BONUS TUNE

  // #region KONAMI Arcade Championship(2023) → BONUS TUNE
  "id30233181", // パーフェクトイーター
  "id80752815", // I-W-U (I Want U)
  "id49153266", // Stylus
  "id95541707", // QQ
  // #endregion KONAMI Arcade Championship(2023) → BONUS TUNE

  // #region STAR RECORD → BONUS TUNE
  "id93047373", // Daily Lunch Special [ 2 ]
  "id56335270", // 蒼空に舞え、墨染の桜 [ 2 ]
  "id82513185", // WARNING×WARNING×WARNING [ 2 ]
  "id51076281", // 千年ノ理 [ 2 ]
  "id72167119", // Angritte
  "id44639013", // Magical electrica
  "id79192682", // Sparkle Justice
  "id31350243", // Capitalism Cannon
  "id66262678", // HAPPY limelight
  "id20362214", // It's my Miracle
  "id77764898", // I LOVE COSMOS
  "id22755571", // fallen leaves
  // #endregion STAR RECORD → BONUS TUNE

  // #region LIGHT CHAT (Limited) → BONUS TUNE
  "id28495190", // 見えない星の渡り方
  "id50978940", // 和beat
  "id66421287", // 怪獣大戦争
  "id90760688", // Anubis
  "id23751776", // After Rain
  "id17414416", // manticore
  "id99611365", // Reach The Sky
  "id12977082", // Insanity: Luna
  "id54598508", // Insanity: Sol
  "id25822016", // Insanity
  "id50601519", // Ice Candy Coaster
  "id33111897", // チックタック＠ラビリンス
  "id47040022", // 4x4 Parallel Universe
  "id33624571", // Caribbean Coast
  "id79040872", // EX-MASSIVE FIGHTER
  "id10244979", // さらさ
  "id91251021", // Fly Above
  "id92393527", // Chewingood!!!
  "id45295020", // Virus Funk
  "id31952814", // Slipstream
  "id58312555", // satfinal
  "id95729690", // Don't believe the hype
  "id96085235", // Go Beyond!!
  "id72866871", // DIAMOND CROSSING
  "id77121509", // シープドリーミン
  "id81419473", // €omet popcorn
  "id85542558", // archive::zip
  "id96209810", // I
  "id54647513", // Freeway Shuffle
  "id79107094", // La libertad
  "id44099530", // Pierce The Sky
  "id96600315", // HAPPY☆LUCKY☆YEAPPY
  "id20994573", // out of focus
  "id55377023", // nightbird lost wing
  "id98768952", // エンドルフィン
  "id10457480", // Blew My Mind
  "id69020094", // Music-U
  "id82005056", // Homesick Pt.2&3
  "id33991432", // nalca
  "id85502520", // BILLION MONEY BAZOOKA
  "id20911452", // 天鈴少女
  "id20094693", // 恋とメロンとキューピット
  "id23841958", // ∞space
  "id47505861", // 24/7 Popperz
  // #endregion LIGHT CHAT (Limited) → BONUS TUNE

  // #region BONUS TUNE
  "id96712659", // 新蛇姫
  "id45268032", // Kilonova
  "id10169179", // Indigo Nocturne
  "id91127357", // White Stream
  "id69014196", // [ ]DENTITY
  "id59219266", // 輪廻の鴉
  "id71481528", // VOLAQUAS -GITADO ROCK ver.-

  "id61524034", // ちくわパフェだよ☆ＣＫＰ (Yvya Remix)
  "id29917039", // めうめうぺったんたん！！ (ZAQUVA Remix)

  "id76899332", // 累乗のカルマ
  "id89690621", // Caldwell 99
  "id28136461", // Touch Me
  "id12417317", // ROCK THE PARTY
  "id44222532", // mathematical good-bye
  "id90512825", // Hexer

  "id70976158", // 残像ニ繋ガレタ追憶ノHIDEAWAY
  "id69309230", // 弾幕信仰
  "id13231232", // SUPER HEROINE!!
  "id32265837", // 閉塞的フレーション

  "id64596876", // 幻想系世界修復少女 [ 2 ]
  "id31262242", // エイリアンエイリアン [ 2 ]
  "id16975111", // ケッペキショウ [ 2 ]
  // #endregion BONUS TUNE

  // #region BEMANI納涼祭2026 (2026-06-18 10:00~2026-08-17 09:59)
  "id20597284", // 不沈艦CANDY
  "id16880225", // Seta Para Cima↑↑
  "id42135581", // Cross Fire
  "id23848733", // 断罪のミメシス
  "id32986336", // Any%
  "id68487703", // Smintheus
  // #endregion BEMANI納涼祭2026 (2026-06-18 10:00~2026-08-17 09:59)
];
/** Ended Event Songs (and also cannot be transmitted) */
const endedEventSongs = [
  // #region LIGHT CHAT - OTOBEAR FROM GITADORA-01 (2024/09/25 10:00～2024/10/23 23:59)
  "id45616999", // Link up
  "id82361373", // Devil’s Rule
  "id90954870", // ◎holic◎
  "id67494878", // THE LAST OF FIREFACE
  // #endregion LIGHT CHAT - OTOBEAR FROM GITADORA-01 (2024/09/25 10:00～2024/10/23 23:59)

  // #region STAR RECORD - BEMANIイントロ (2024/07/23～2024/09/04)
  "id22676528", // 6次の隔たり
  // #endregion STAR RECORD - BEMANIイントロ (2024/07/23～2024/09/04)

  // #region こっちも！Triple Tribe (2026/03/26 10:00～2026/04/26 23:59)
  "id42003685", // シュボレアちゃん星の交信
  "id47896490", // 朧月覆う雲をも裂きぬ
  "id29946212", // RUINA
  // #endregion こっちも！Triple Tribe (2026/03/26 10:00～2026/04/26 23:59)
];

/** flags - song id mapping */
const songflags: Record<string, string[]> = {
  unlock: [
    ...currentEventsSongs,

    // #region LIGHT CHAT (Ave.)
    "id24588368", // 不可説不可説転
    "id64509859", // Slluuddggee
    "id36662014", // Wowie Zowie!
    "id16485380", // Confiserie
    // #endregion LIGHT CHAT (Ave.)

    // #region STAR RECORD - ちくわまつり2023 (LIGHT CHAT "CONCIERGE" or transmition)
    "id76700455", // クラゲファンタジーソーダ
    "id24010732", // ハートシェイプ・スピカ
    "id99056992", // cosmic agenda ～一舞 edition～
    "id56278960", // メモリーズ
    "id76493819", // 遠く遠く離れていても…
    "id97206656", // Finally Dive
    "id38982479", // 空言の海 ～咲子 edition～
    "id86136434", // ステラレギア
    "id46156646", // 寂寞たる世界の終末は
    "id66488910", // jet coaster☆girl ～まり花 edition～
    "id60660911", // 双星ルミネセンス
    "id54905389", // 恋はどう？モロ◎波動OK☆方程式!! ～めう edition～
    "id20677328", // 空の飛び方
    "id11474607", // ムラサキグルマ
    // #endregion STAR RECORD - ちくわまつり2023 (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat (LIGHT CHAT "CONCIERGE" or transmition)
    "id11455076", // あいのうた
    "id88151052", // I love マミー
    "id67469002", // In Scottish Highlands
    "id92987568", // GIGA BREAK
    "id67780562", // Crosswind
    "id81355986", // Jumping Boogie
    "id47211790", // Slang
    "id18346724", // Chance and Dice
    "id45641891", // Happy Happy
    // #endregion jubeat (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat ripples (LIGHT CHAT "CONCIERGE" or transmition)
    "id18798856", // eyes
    "id88336511", // INVISIBLE WORLD
    "id61440275", // ECO FIGHTER
    "id59060891", // Queen's Paradise
    "id31462334", // コイノチカラ
    "id22401731", // SWEET ANGEL
    "id63527834", // STARLIT DUST/スティルに捧ぐ
    "id59286717", // Macuilxochitl
    // #endregion jubeat ripples (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat knit (LIGHT CHAT "CONCIERGE" or transmition)
    "id17449812", // 愛と勇気の三度笠ポン太
    "id38917405", // KUNG-FU MAMA
    "id20384360", // Green Green Dance
    "id68513124", // Jailbreak
    "id62767087", // Shining Wizard
    "id95633959", // STELLAR WIND
    "id52058898", // STREET DANCER
    "id66219795", // Prophet Vibe
    "id53923081", // Ready Go!!
    // #endregion jubeat knit (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat copious (LIGHT CHAT "CONCIERGE" or transmition)
    "id20087317", // yellow head joe
    "id25803878", // 800nm
    "id93361888", // 逆ナンされたのにドタキャン!!
    "id31856112", // Starlight Parade
    "id81841520", // DOUBLE IMPACT
    "id85881583", // Devil Fish Dumpling
    "id12348190", // TWINKLE♡HEART
    "id27250167", // ナナホシ
    "id59220571", // HEAT-BIT-HIT-BEAT
    "id85005886", // Plum
    "id66657141", // FRIENDSHIP
    "id66657141", // polygon
    "id88606203", // 瞬
    "id29587963", // Riot of Color
    "id74606879", // Rush!!
    "id27715455", // Red Goose
    "id57336008", // WONDER WALKER
    // #endregion jubeat copious (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat saucer (LIGHT CHAT "CONCIERGE" or transmition)
    "id67308265", // I/O
    "id78531127", // 愛は不死鳥の様に
    "id86221988", // アストライアの双皿
    "id80303856", // attack in the minor key
    "id28274298", // Amalgamation
    "id40639158", // 雨ノチHello
    "id22431808", // Our Faith
    "id58218011", // イ号零型
    "id80768363", // Vanity
    "id96172488", // We're so Happy
    "id86466692", // Windy Fairy
    "id15809599", // 梅雪夜
    "id25675641", // 8 -eight-
    "id38431062", // Engraved Mark
    "id41074859", // Endless Chain～2人でトリガーをひこう～
    "id89482901", // O JIYA
    "id38690018", // OVERHEAT -Type J-
    "id94239920", // 影縫い胤撒き
    "id31676747", // Cassis
    "id33451015", // キケンな果実
    "id16679442", // Gimme a Big Beat
    "id60078991", // caramel ribbon
    "id71344918", // キラキラ☆ステーション
    "id43194464", // Clumsy thoughts
    "id28165755", // 紅蓮の焔
    "id47749853", // 恋はどう？モロ◎波動OK☆方程式！！
    "id77625020", // Go For The Top
    "id95321203", // Cosmic Hurricane
    "id54681325", // Gott
    "id37762673", // この青空の下で
    "id68609081", // Concertino in Blue
    "id54809241", // 防人恋歌
    "id37935774", // SEED
    "id42747309", // 此岸の戯事
    "id27213864", // 終末を追う者
    "id79662312", // 少年は空を辿る
    "id45604864", // SILVER☆DREAM
    "id31720718", // Sky Is The Limit
    "id39020806", // Squeeze
    "id88782471", // Stand Alone Beat Masta
    "id82145887", // Stella Sinistra
    "id65014035", // ストレイ・マーチ
    "id66115906", // Straight Oath
    "id86019607", // Snowfield Express
    "id77702017", // snow prism
    "id56296380", // spring pony
    "id69956690", // 蒼天
    "id22260840", // Sol Cosine Job 2
    "id47970281", // Dynasty
    "id47209408", // TSAR BOMBA
    "id21184698", // ツキミチヌ
    "id72286665", // DIAVOLO
    "id46492530", // December Breeze
    "id37075687", // Twinkle Wonderland
    "id32493613", // Thor's Hammer
    "id18613108", // DRAGON KILLER
    "id88628546", // Dragon Blade
    "id39782356", // NIGHT FLIGHT
    "id34981760", // IX
    "id11388842", // New Gravity
    "id27488736", // Never Look Back in Sorrow
    "id17765003", // neu
    "id65755877", // HEART BEAT FORMULA
    "id86944748", // Happy
    "id72448599", // PUNISHER
    "id11710721", // PULSE LASER
    "id12493693", // Hello world!
    "id76663724", // Beastie Starter
    "id11927571", // V
    "id13606353", // 405nm (Ryu☆mix)
    "id70239270", // PRANA
    "id19415244", // Fly with me
    "id41082796", // Plan 8
    "id89633908", // Brand New World
    "id80112112", // Flip Flap
    "id17799550", // BLUE STRAGGLER
    "id67530945", // Proof of the existence
    "id93053583", // Broken
    "id17821805", // heron
    "id46063791", // POINT ZERO
    "id96817913", // 亡国のヒストリア
    "id98971641", // Holy Snow
    "id74744457", // Mynarco
    "id39315916", // Magnetic
    "id88056675", // Mirage
    "id21915571", // milky ice bear
    "id64577879", // Move That Body
    "id45651922", // 野球の遊び方　そしてその歴史　～決定版～
    "id95110867", // Unicorn tail Dustboxxxx RMX
    "id65513899", // Right on time (Ryu☆ Remix)
    "id43064647", // Life Connection
    "id18819140", // LUV CAN SAVE U
    "id37425143", // リメンバーリメンバー
    "id41034568", // le mirage
    "id34647818", // Ray
    "id78275717", // RED ZONE
    "id81084086", // 恋愛観測
    "id57874429", // 恋閃繚乱
    "id71533198", // robin
    "id24940201", // Romancing Layer
    // #endregion jubeat saucer (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat saucer fulfill (LIGHT CHAT "CONCIERGE" or transmition)
    "id39623216", // 朱と碧のランページ
    "id21767447", // athletic meet of sound toy
    "id28308820", // encounter
    "id61393387", // aura
    "id96391664", // 御千手メディテーション
    "id43629783", // KHAMEN BREAK
    "id96312088", // Cleopatrysm
    "id27196307", // コドモライブ
    "id70584390", // STERLING SILVER
    "id93872142", // Spanish Snowy Dance
    "id96685646", // 7 Colors
    "id33567796", // time granular
    "id52440323", // Timberwolves
    "id93008889", // 10,000,000,000
    "id44237248", // ドーパミン
    "id86120863", // Nature (jubeat version)
    "id60324251", // 猫侍の逆襲
    "id33033104", // passionate fate
    "id35678669", // HYDRA
    "id26252561", // Follow Tomorrow
    "id32715498", // planarian
    "id44549278", // Blue Goose
    "id36280106", // フレッフレー♪熱血チアガール
    "id25337835", // まるでマトリョーシカ
    "id69740316", // Milchstraße
    "id23747497", // Mono Logic
    "id58919478", // unisonote
    // #endregion jubeat saucer fulfill (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat prop (LIGHT CHAT "CONCIERGE" or transmition)
    "id69177930", // Ausretious#1-まどろみ、或いは嘆色の夢-
    "id78766102", // アガット
    "id51647087", // アレスの楯
    "id67864424", // We're so Happy [ 2 ]
    "id22855698", // overcomplexification
    "id10371252", // きらきらタイム☆
    "id61367554", // glacia
    "id73891308", // glacia [ 2 ]
    "id39428414", // Crack Traxxxx
    "id77971855", // Chloé
    "id80861996", // croiX
    "id67329745", // Sacrifice for Justice
    "id75201890", // citrus
    "id34133411", // Just Believe
    "id62533519", // SWEET HOME PARTY
    "id80014809", // ススススペースハリネズミ
    "id65165304", // 超越してしまった彼女と其を生み落した理由
    "id37236895", // 天空の華
    "id12554284", // TWINKLING
    "id76605801", // Two Pianists
    "id68500959", // Too Late Snow [ 2 ]
    "id76884449", // トリカゴノ鳳凰 [ 2 ]
    "id31625765", // Towards the TOWER
    "id67368476", // †渚の小悪魔ラヴリィ～レイディオ† [ 2 ]
    "id13590120", // 夏色DIARY 俺のjubeat編
    "id27250986", // 日天悦扇紊舞
    "id58189606", // Niflheimr
    "id39550231", // FLOWER [ 2 ]
    "id98252495", // freaky freak
    "id60101599", // 炎のDiargos
    "id34595498", // 雪女
    "id75837790", // Love ♡ km [ 2 ]
    "id56688980", // Lovesick Lovetune
    "id28052737", // 龍と少女とデコヒーレンス
    "id64944942", // 霖が哭く
    "id18176474", // Rock The Club
    "id82027807", // robin [ 2 ]
    // #endregion jubeat prop (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat Qubell (LIGHT CHAT "CONCIERGE" or transmition)
    "id34933648", // Ark
    "id73327266", // aleatrik
    "id88641784", // アキネイション
    "id93678024", // Against the vulgar aggressor
    "id77815447", // Invisible Border
    "id86891582", // veRtrageS
    "id25701288", // Valanga
    "id16842684", // Windy Fairy [ 2 ]
    "id35588499", // UROBOROS OVERDIVE
    "id20847279", // 枝に結ぶ願い [ 2 ]
    "id67425463", // Entrapment
    "id19284003", // CARNIVOROUS
    "id93308516", // 怪盗BisCoの予告状！！
    "id12918355", // KAMAITACHI
    "id32501912", // キミとワタシのオンガク
    "id60872273", // Qubellic Prism
    "id52100153", // Glitter Flatter Scatter
    "id38150846", // crêpe suzette
    "id44910700", // 檄
    "id19803389", // ケンぱ！ケンぱ！拳拳ぱん打！
    "id34098416", // Cosminflation
    "id46359738", // CIRCUS U CRIC
    "id13908684", // Saturday Night Love
    "id48661512", // The Omen
    "id37267395", // Just a Game
    "id57012516", // スカイダイバー
    "id13666670", // Sky High
    "id58491653", // SPACE VILLAGE
    "id56141250", // それは花火のような恋
    "id50702539", // 旅の終わりと祝祭の夜
    "id75958326", // CHERNOBOG
    "id17619739", // Destiny lovers
    "id87973675", // 天嘩乱舞
    "id64536306", // トキメキストリーム
    "id10147544", // NISHIMURA -祭- CARNIVAL
    "id35261432", // にゃんのパレードマーチ♪
    "id86474836", // New York EVOLVED
    "id12686883", // Knell
    "id73919507", // 爆なな☆てすとロイヤー
    "id58833238", // Hunny Bunny
    "id31067644", // バビロニアの旅人たち
    "id75884089", // Hollywood Galaxy
    "id51831679", // ぱんだしんけん１、２、３ ～ちえ！おっしょさんにはかなわないや！～
    "id48676349", // びいすと！
    "id88787965", // Four Leaves
    "id71192914", // FUJIMORI -祭- FESTIVAL
    "id95425636", // BLACK or WHITE?
    "id62460393", // Bleep Beep Bop
    "id62687114", // FLOOR INFECTION Medley from SOUND VOLTEX×jubeat
    "id60312935", // Boss Rush
    "id13414719", // POLICY BREAK Medley from SOUND VOLTEX×jubeat
    "id79443709", // 見習い天使と星降りの丘
    "id56480878", // Mirage of the Mirror
    "id63368286", // 夢有
    "id24925584", // Megalara Garuda
    "id44709658", // RHYZING BEAT
    "id77012234", // Lost wing at.0
    "id73672309", // ロプノールの商隊
    "id63578142", // 分けるな危険！モモモモモモーイズム
    // #endregion jubeat Qubell (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat clan (LIGHT CHAT "CONCIERGE" or transmition)
    "id10220164", // Ausretious#1-まどろみ、或いは嘆色の夢- [ 2 ]
    "id38556629", // アガット [ 2 ]
    "id99691018", // アドレナリン
    "id63186908", // EXUSIA
    "id73897193", // イ号零型 [ 2 ]
    "id40049693", // If
    "id35182739", // In The Ruins
    "id53807004", // Welcome!!
    "id60164837", // Aerial Skydive
    "id44317258", // Everybody's Rich
    "id29529825", // AI
    "id17475068", // Evans ～NOSTALGIA Ver. ～
    "id76745469", // エレシュキガル
    "id57325800", // カラルの月 [ 2 ]
    "id29314677", // 変わりゆく時間とノスタルジアと
    "id19372761", // CandyPop★Showcase
    "id91925485", // 狂髪天を撫でて綴れ雲の綻び　五体北風に散りて痕も無し
    "id87641973", // Couleur=Blanche
    "id98329407", // Xibercannon
    "id93652328", // SEED [ 2 ]
    "id49592885", // Shout!!
    "id72528887", // Jazz is Rad
    "id22243595", // 白い雪のプリンセスは [ 2 ]
    "id10456845", // Singularity
    "id79896257", // 水槽のクジラ
    "id57338079", // SUPER SUMMER SALE
    "id59122490", // Scars of FAUNA [ 2 ]
    "id88392995", // STAR SHIP☆HERO
    "id82021120", // Spirit of the Beast
    "id72583550", // smooooch・∀・ [ 2 ]
    "id64856451", // Diastrophism
    "id91744188", // chaplet [ 2 ]
    "id37042292", // Chocolate Planet
    "id35158730", // 月に叢雲華に風 [ 2 ]
    "id84157981", // トキメキメカニクス
    "id63344250", // 虹の先に何があるか
    "id62190277", // Necroxis Girl
    "id26689902", // Never See You Again
    "id72753217", // Northern Wind
    "id63734374", // No One Can Reach The Truth
    "id71416315", // Passion
    "id99440992", // パピポペピプペパ
    "id85563063", // Pee-wee Boogie
    "id77334153", // PF flowing
    "id64027231", // Puberty Dysthymia
    "id95358154", // Pink Rose [ 2 ]
    "id14066836", // Fairy Fair
    "id97015591", // Fox4-Raize-
    "id41496555", // Blue Sky
    "id89165674", // Prey
    "id20356991", // Prayer
    "id63763250", // Pale Garden
    "id65441471", // HEAVENLY MOON [ 2 ]
    "id85686812", // ヘンゼルとグレーテル
    "id16198822", // みたらしプラトニック (feat. nicamoq)
    "id56377933", // Midnight City Warfare
    "id39733566", // ヤマトなでなで♡かぐや姫
    "id63211304", // Life is beautiful
    "id45736087", // Last Dress
    "id58172715", // Rampage☆Rag
    "id10476503", // Rejoin
    "id36477210", // Roll the Dice
    "id67446138", // Wandering Gravity
    "id50561040", // One More Reason
    // #endregion jubeat clan (LIGHT CHAT "CONCIERGE" or transmition)

    // #region jubeat festo (LIGHT CHAT "CONCIERGE" or transmition)
    "id24104712", // Icicles [ 2 ]
    "id35406017", // I'm so Happy [ 2 ]
    "id81201841", // ATRAX
    "id65192665", // Analyse Katharsis
    "id48992638", // Apex of the World
    "id35018326", // 雨上がりの空に
    "id86455991", // アモ
    "id87247277", // Arena Deiporta
    "id31864666", // Our Faith [ 2 ]
    "id63880350", // Our Love
    "id40537881", // Underground Astronomy
    "id83135244", // いーあるふぁんくらぶ [ 2 ]
    "id70401948", // 1116
    "id23163274", // Idola (BEMANI SYMPHONY Arr.)
    "id10145048", // インドがパッカーン！！煩悩マハラジャドリーム
    "id27257536", // Virtual Bit
    "id66802771", // VIKING SHIP
    "id35584339", // VALLIS-NERIA [ 2 ]
    "id45287832", // Welcome to the Mosh Pit
    "id34708238", // WELCOME TO MOTOWN PARK
    "id75722936", // ETERNAL BLAZE [ 2 ]
    "id12760488", // X-Plan
    "id47945401", // Everlasting Message (BEMANI SYMPHONY Arr.)
    "id42079632", // EMOTiON TRiPPER
    "id24081249", // Element of SPADA (BEMANI SYMPHONY Arr.)
    "id46791423", // All Clear!!
    "id34654093", // ALL MY HEART -この恋に、わたしの全てを賭ける- [ 2 ]
    "id95324011", // 朧 (BEMANI SYMPHONY Arr.)
    "id43148807", // Catapulted Arch
    "id79449781", // [E] [ 2 ]
    "id96490588", // Come to Life
    "id38923868", // Colorful Cookie (BEMANI SYMPHONY Arr.)
    "id10343674", // 眼光 [ 2 ]
    "id16885730", // キヤロラ衛星の軌跡
    "id30074101", // 狂水一華
    "id65055123", // Queen's Paradise [ 2 ]
    "id49645821", // Glitter Cube
    "id83499276", // Crazy Shuffle
    "id66752395", // cloche [ 2 ]
    "id53914150", // Chronos [ 2 ]
    "id41125010", // 激闘保安官！DEMPA撲滅大作戦
    "id87207439", // Get On The Floor
    "id83063282", // 恋歌疾風！かるたクイーンいろは
    "id37022684", // 恋 No リセットゲーム!!!!!
    "id87226936", // Ghost Clock
    "id36205289", // 虚空と光明のディスクール [ 2 ]
    "id90149613", // COSMIC SYMPHONY
    "id71447285", // The Kingsroad
    "id19907858", // Sakura Sunrise [ 2 ]
    "id25506943", // さよなら世界 (BEMANI SYMPHONY Arr.)
    "id69039415", // サヨナラ・ヘヴン [ 2 ]
    "id26866892", // サヨナラ・ヘヴン (BEMANI SYMPHONY Arr.)
    "id35621878", // Jetcoaster Windy
    "id77278486", // SigSig [ 2 ]
    "id93455464", // 灼熱Beach Side Bunny
    "id30027672", // 少女、摩天楼へ
    "id47137132", // 情熱大陸 [ 2 ]
    "id84254998", // Super GERO GE-RO
    "id39693677", // スーパー戦湯ババンバーン
    "id54812767", // Scarlet Moon [ 2 ]
    "id78481410", // StaRgAZER
    "id65836580", // starmine (BEMANI SYMPHONY Arr.)
    "id89219253", // Still Lonesome
    "id53678450", // Snow Goose [ 2 ]
    "id99868652", // スノーホワイト
    "id39229859", // Sparkle Smilin'
    "id96942210", // Spica
    "id13711302", // splash!
    "id94912329", // SPACE INASAKU
    "id25707124", // スペースカーニバル [ 2 ]
    "id48373212", // zeeros
    "id22827894", // XENOViA
    "id20657624", // 創世ノート [ 2 ]
    "id88206606", // sola [ 2 ]
    "id70296722", // Sorrows
    "id19793220", // Timepiece phase II (BEMANI SYMPHONY Arr.)
    "id85389376", // 太陽の滴
    "id50452026", // 茶渋シンドローム
    "id43035116", // 追憶のアラウカリア
    "id35576894", // ツーマンライブ [ 2 ]
    "id84842043", // つぼみ [ 2 ]
    "id38497493", // December in Strasbourg
    "id65599283", // Din Don Dan
    "id68487003", // Duality
    "id98123279", // 天空の夜明け (BEMANI SYMPHONY Arr.)
    "id94556128", // Toy Robot Factory
    "id59690248", // TOON MANIAC
    "id11557003", // True Blue [ 2 ]
    "id37035492", // TRIUMPH
    "id96437401", // Dream drip macchiato
    "id80909498", // 取り残された美術(Arranged:HiZuMi) [ 2 ]
    "id89731744", // 嘆きの樹 (BEMANI SYMPHONY Arr.)
    "id15256365", // Neuron
    "id95402114", // Noob実況24時!
    "id70563135", // ネリと琥珀糖
    "id40076790", // No Rule Adventure
    "id22216208", // Hades Doll
    "id21165222", // Pacify
    "id77956060", // バッドエンド・シンドローム (BEMANI SYMPHONY Arr.)
    "id60289888", // BEEF
    "id24078335", // ピザが食べたくてしょうがない皆さんの気持ちを代弁しました
    "id37250399", // Beyond the BLUE
    "id19943085", // Fireball
    "id43099933", // Phantasmagoria
    "id51665960", // FLOWER (BEMANI SYMPHONY Arr.)
    "id32734305", // Proof of the existence [ 2 ]
    "id81490397", // Brawl
    "id17117809", // Floating Eternity
    "id65995720", // Pegasus
    "id86693326", // pedigree
    "id83121687", // Hopeful Frontier!!!
    "id77858176", // 僕らの時間
    "id45828280", // 星の小舟
    "id65788635", // POSSESSION (BEMANI SYMPHONY Arr.)
    "id13095404", // HOT LIMIT [ 2 ]
    "id95379463", // Polaris [ 2 ]
    "id91890586", // MA・TSU・RI
    "id34292876", // Midsummer Madness
    "id33822419", // MOVE! (We Keep It Movin')
    "id75640546", // 斑咲花
    "id24758171", // 廻る季節のゆく先に
    "id81370968", // MODEL FT2 Miracle Version
    "id19301407", // unisonote [ 2 ]
    "id40535394", // ゆめのかなたで
    "id80068784", // ユメブキ
    "id76858116", // LIKE A VAMPIRE
    "id95323646", // Light Shine
    "id14837596", // Right Time Right Way
    "id22248883", // Life Without You
    "id61337590", // Life Connection [ 2 ]
    "id98515350", // Lachryma《Re:Queen’M》 (BEMANI SYMPHONY Arr.)
    "id66939121", // LAST OATH
    "id47975509", // LANA - キロクノカケラ - [ 2 ]
    "id97759726", // Lava Flow
    "id41668903", // Lava Flow [ 2 ]
    "id14431976", // ラプンツェル
    "id79570740", // Lisa-RICCIA (BEMANI SYMPHONY Arr.)
    "id96116681", // 流砂の嵐 (BEMANI SYMPHONY Arr.)
    "id45161618", // リリーゼと炎龍レーヴァテイン
    "id35725097", // RAISE YOUR HEADS UP
    "id31684764", // Radius
    "id70830611", // ロストワンの号哭 [ 2 ]
    "id98312654", // ROCK ju
    "id16786845", // ロミとロボの宇宙飛行
    "id97423720", // 海神 (BEMANI SYMPHONY Arr.)
    "id20515722", // Wuv U
    // #endregion jubeat festo (LIGHT CHAT "CONCIERGE" or transmition)
  ],
  noTransmission: [...currentEventsSongs, ...endedEventSongs],
  tempUnlock: [
    ...endedEventSongs,

    // #region jubeat festo events (excluded LIGHT CHAT "CONCIERGE", but can be transmitted)

    // #region フラッグラリー！！
    "id38492405", // 鋳鉄の檻
    "id13047998", // チュッチュ♪マチュピチュ
    "id46541821", // Globe Glitter
    "id37695090", // DUAL STRIKER
    // #endregion フラッグラリー！！

    // #region Mission Travel
    "id51581262", // ピアノ独奏無言歌 "灰燼"
    "id49806690", // Hero Revealed
    // #endregion Mission Travel

    // #region Stamp Challenge
    "id56793934", // Chippin Break
    "id52904405", // Laughin' Muffin
    "id24987037", // Metsysralos
    "id55017076", // Juicy
    "id44035849", // リカーシブ・ファンクション
    "id55398915", // 海神
    // #endregion Stamp Challenge

    // #region BPL応援 楽曲解禁スタンプラリー
    "id53743550", // Boomy and The Boost
    "id16308284", // Catch Me
    // #endregion BPL応援 楽曲解禁スタンプラリー

    // #endregion jubeat festo events (excluded LIGHT CHAT CONCIERGE, but can be transmitted)
  ],
  eAmusement: [
    // #region jubeat
    "id35367035", // Icicles
    "id26243783", // IN THE NAME OF LOVE
    "id54355142", // SigSig
    "id25574425", // Snow Goose
    "id95915185", // Special One
    "id35802983", // TRUE♥LOVE
    "id13239494", // bass 2 bass
    "id38381201", // Polaris
    // #endregion jubeat

    // #region jubeat ripples
    "id89950113", // ALBIDA
    "id80401748", // AIR RAID FROM THA UNDAGROUND
    "id62369331", // AREA 51
    "id46576344", // coming true
    "id11893148", // Good-bye Chalon
    "id80304845", // 恋のメリーゴーランド
    "id15097558", // Shining Star
    "id80331613", // 少年リップルズ
    "id64604535", // スペースカーニバル
    "id44526843", // 隅田川夏恋歌
    "id81681558", // Lead Me
    "id33264982", // Russian Snowy Dance
    // #endregion jubeat ripples

    // #region jubeat knit
    "id47536415", // うらもからだも落花微塵
    "id33152193", // ALL MY HEART -この恋に、わたしの全てを賭ける-
    "id17479636", // キルト
    "id61969779", // concon
    "id61211006", // さよならトリップ
    "id66816079", // Shine On Me
    "id52592044", // Sweet Rain\
    "id93380763", // Theory of Eternity
    "id25844357", // Far east nightbird
    "id50474670", // fellow	ピンクターボ	Ave.以降
    "id68218329", // Love ♡ km
    // #endregion jubeat knit

    // #region jubeat copious
    "id53983513", // 歌の翼
    "id53221622", // electro peaceful
    "id87969050", // 陽炎
    "id13004126", // [E]
    "id13606746", // ギタ・ドラ・jubeat大夏祭りのテーマ
    "id17882229", // candii
    "id34167650", // cloche
    "id53647696", // The Wind of Gold
    "id85522159", // Summer Holiday
    "id84493602", // 幸せのかたち
    "id22601746", // JOMANDA
    "id96874613", // THIS NIGHT (jubeat EDITION)
    "id14981562", // 532nm
    "id79289857", // HEAVENLY MOON
    "id21823050", // RePrise
    "id68139959", // 流砂の嵐
    "id52833291", // 量子の海のリントヴルム
    // #endregion jubeat copious

    // #region jubeat saucer
    "id65752303", // Across the nightmare
    "id44353410", // Asterism
    "id30535746", // anemone
    "id37086663", // Arousing
    "id29143489", // Vermilion
    "id71531011", // VALLIS-NERIA
    "id49736118", // Wow Wow VENUS
    "id86560381", // Water Horizon
    "id40341027", // Empathetic
    "id15743094", // お米の美味しい炊き方、そしてお米を食べることによるその効果。
    "id79824362", // 朧
    "id62233223", // GAIA
    "id38724730", // カラフルミニッツ
    "id32509817", // カラルの月
    "id64008785", // 記憶の欠片
    "id91793867", // 君の元へ
    "id42911287", // quaver♪
    "id69449996", // 黒髪乱れし修羅となりて
    "id37027741", // Chronos
    "id79016920", // 恋する☆宇宙戦争っ!!
    "id40088443", // 紅焔
    "id82667668", // この子の七つのお祝いに
    "id25821002", // Condor
    "id48868599", // Sakura Sunrise
    "id83821360", // サヨナラ・ヘヴン
    "id81901778", // Synergy For Angels
    "id89241638", // squall
    "id13458909", // STULTI
    "id41664082", // smooooch・∀・
    "id58744251", // 晴天Bon Voyage
    "id12855861", // Second Heaven
    "id69379076", // ZED
    "id21911919", // ZZ
    "id84931910", // 創世ノート
    "id97386402", // sola
    "id31484584", // TYCOON
    "id32623578", // 闘いの刻 -jubeatREMIX-
    "id31719195", // chaplet
    "id85978964", // つぼみ
    "id43591137", // Dispersion Star
    "id61314544", // Daily Lunch Special
    "id44711214", // デッドボヲルdeホームラン
    "id56048043", // 天上の果て
    "id91275682", // True Blue
    "id84532508", // 轟け！恋のビーンボール！！
    "id56857429", // Dragontail Butterfly
    "id35636161", // トリカゴノ鳳凰
    "id17939306", // Triple Journey -S-C-U EDITION-
    "id24648889", // †渚の小悪魔ラヴリィ～レイディオ†
    "id11563994", // 夏・KOI・ムッシュ!!
    "id69175252", // 虹色の花
    "id17344438", // New Decade
    "id59390357", // HYENA
    "id13641724", // 華爛漫 -Flowers-
    "id70175212", // ヒーロー
    "id68582517", // Pink Rose
    "id80839408", // Fantasia
    "id39034414", // フー・フローツ
    "id48562361", // ふしぎなくすり
    "id58481108", // Baby Bleep March
    "id95455468", // 星屑のキロク
    "id30870430", // ほしふり
    "id37280801", // ポップミュージック論
    "id31435322", // マインド・ゲーム
    "id56219942", // Mother Ship
    "id32356338", // ラキラキ
    "id76353598", // 万華鏡
    "id32939729", // 優勢オーバードーズ
    "id71640525", // Lisa-RICCIA
    "id55443288", // Little Star
    "id46302853", // Rainbow after snow
    "id24651896", // 我が麗しのバレンシア
    // #endregion jubeat saucer

    // #region jubeat saucer fulfill
    "id37476669", // 枝に結ぶ願い
    "id58323521", // Energy
    "id94771363", // SHION
    "id80299225", // DANCE ALL NIGHT
    "id15061079", // High School Love
    "id77857711", // Ha・lle・lu・jah
    "id51351168", // FUNKY SUMMER BEACH
    "id81173950", // BLUE DRAGON
    "id69362036", // ポチコの幸せな日常
    "id83121235", // Metric
    "id20181683", // Little Flipper
    "id99703872", // Resurrection
    // #endregion jubeat saucer fulfill

    // #region jubeat prop
    "id17308557", // 天ノ弱 [ 2 ]
    "id93247578", // 妖隠し -あやかしかくし-
    "id43796075", // In The Breeze
    "id34227316", // エキサイティング！！も・ちゃ・ちゃ☆
    "id93510320", // EBONY & IVORY
    "id75487328", // 完全無欠の無重力ダイブ
    "id29523504", // 3 A.M. ディテクティブ・ゲーム
    "id64137901", // 千年ノ理
    "id15549172", // 竹取飛翔 ～ Lunatic Princess (Ryu☆Remix)
    "id45078883", // Diargosの森
    "id39345258", // twinkle noise
    "id73689061", // Too Late Snow
    "id93995688", // とびっきりのふわっふわ
    "id47951489", // 走れメロンパン [ 2 ]
    "id92215787", // パ→ピ→プ→Yeah!
    "id13978373", // ビビットストリーム
    "id45475114", // Braid & Blade
    "id13652907", // prop the world
    "id53924712", // プレインエイジア -PHQ remix-
    "id47790925", // ほおずき程度には赤い頭髪
    "id94007069", // ぽかぽかレトロード
    "id67278058", // ホメ猫☆センセーション
    "id67462485", // Russian Caravan Rhapsody
    "id15297115", // 惑星☆ロリポップ
    // #endregion jubeat prop

    // #region jubeat Qubell
    "id88644151", // Vampire Killer
    "id18513582", // ULTRA HAPPY MEGAMIX
    "id88963399", // 運命
    "id57643043", // KHAMEN BREAK -SDVX Infinity MashUp-
    "id30275084", // がんばれゴエモン　～ ビーストメドレー ～
    "id57915638", // GRADIUS II　～ ビーストメドレー ～
    "id48745291", // Grand Chariot
    "id38233349", // 月風魔伝　～ ビーストメドレー ～
    "id45157594", // Giant Otter Family
    "id84059908", // StrayedCatz
    "id79082548", // ZEPHYRANTHES
    "id77650819", // Sephirot
    "id54430198", // Daisuke
    "id18665252", // Twinbee's Home Town Song
    "id41154864", // Triple Counter
    "id58167529", // バビロニア
    "id86017151", // Phlox
    "id69487953", // 変じゃない!!
    "id73759698", // 星宿る空の下で
    "id43167072", // 蟲の棲む処
    "id38651794", // 六花にくちづけ
    // #endregion jubeat Qubell

    // #region jubeat clan
    "id29119352", // Another Phase
    "id77145984", // Alive in my Soul
    "id32219255", // キリステゴメン
    "id95571216", // けもののおうじゃ★めうめう
    "id93796101", // 飽和世界
    "id19334013", // Sulk
    "id59861282", // シノビシノノメ
    "id74063601", // 銃弾は解を撃ち抜いて
    "id17181753", // 星座が恋した瞬間を。
    "id93312790", // たからもの
    "id14196838", // Drizzly Venom
    "id50594127", // ナイト・オブ・ロンド
    "id48838105", // birth
    "id73804258", // 羽根亡キ少女唄
    "id72765009", // Be a Hero!
    "id54963313", // 風鈴花火
    "id67690440", // Fly far bounce
    "id86168797", // ミカヅキ:コネクト
    "id26379539", // ミラクル・スイート・スイーツ・マジック！！
    "id42134193", // レゾンデートル、前線より
    // #endregion jubeat clan

    // #region jubeat festo
    "id94321479", // Agnus Dei
    "id44587429", // In Your EyEs
    "id79508629", // Winter Gift ～クリスピーからの贈りもの～
    "id28874482", // Endless Beats ⇔ Endless Parties
    "id65037187", // おにぎりディスコ
    "id43751257", // 革命パッショネイト
    "id10429194", // Catch Our Fire!
    "id11076676", // Surf on the Light
    "id91982258", // Sahara
    "id41933957", // Samba Ramba
    "id64106986", // 幸せが鳴る夜に
    "id93025807", // シンクロフィッシュ
    "id81147879", // スイーツはとまらない♪
    "id98466859", // スミスえかきうた
    "id10564761", // 世界の果てに約束の凱歌を -jubeat edition-
    "id17044725", // 拙者拙者拙者拙者
    "id36436376", // たたえよ！絶対覇権アリーシャ帝国
    "id68510627", // タンポポ
    "id96407127", // 月影小町
    "id67167088", // 熱情のサパデアード
    "id36246817", // 箱庭のエチュード
    "id86351682", // ヒカリユリイカ
    "id53209946", // ビター・エスケープ
    "id99950175", // ビューティフル レシート
    "id23459302", // 50th Memorial Songs -The BEMANI History-
    "id23448053", // 50th Memorial Songs -二人の時 ～under the cherry blossoms～-
    "id62642565", // 50th Memorial Songs -Flagship medley-
    "id42944351", // 封隠文様
    "id83210360", // ベビーステップ
    "id83313368", // POSSESSION
    "id69247548", // めた・メタ？ひまわり＊パンチ
    "id67531941", // ラブキラ☆スプラッシュ
    "id35816923", // ランカーキラーガール
    // #endregion jubeat festo
  ],
};

const songFlagEntries = Object.entries(songflags);

const getFlagsFromSaHash = (saHash?: string): string[] => {
  if (!saHash) {
    return [];
  }

  return songFlagEntries
    .filter(([, songIds]) => songIds.includes(saHash))
    .map(([flag]) => flag);
};

const updateSongFlags = (song: Song, ...preserveFlags: string[]) => {
  const preservedFlags = (song.flags || []).filter((flag) =>
    preserveFlags.includes(flag),
  );

  const mergedFlags = [
    ...new Set([...preservedFlags, ...getFlagsFromSaHash(song.saHash)]),
  ];

  if (mergedFlags.length === 0) {
    delete song.flags;
    return;
  }

  song.flags = mergedFlags;
};

task("Import Jubeat", async ({ task, setStatus, setError }) => {
  const cleanup = reportQueueStatusLive(task);
  try {
    const targetFile = path.resolve(
      path.join(__dirname, `../src/songs/${fileName}`),
    );

    const existingData: GameData = JSON.parse(
      await readFile(targetFile, { encoding: "utf-8" }),
    );

    await Promise.all([
      task("Licensed songs", async ({ setStatus, setTitle, task }) => {
        // Fetch licensed songs
        setStatus("Fetching licensed songs from e-amusement GATE...");
        const licensedImporter = new SongImporter(licensedSongUrl);
        const licensedSongs = await licensedImporter.fetchSongs(task);

        // Process licensed songs
        setStatus("Processing all licensed songs...");
        for (const fetchedSong of licensedSongs as ((typeof licensedSongs)[number] &
          Partial<Song>)[]) {
          const existingSong = existingData.songs.find((s) =>
            licensedImporter.songEquals(s, fetchedSong),
          );

          if (existingSong) {
            await tryGetMetaFromRemy(existingSong, "Jubeat");
            licensedImporter.merge(existingSong, fetchedSong);
            updateSongFlags(
              existingSong,
              "licensed",
              "asiaLocked",
              "koreaLocked",
              "holds",
            );
          } else {
            console.log(`Adding new licensed song: ${fetchedSong.name}`);
            await tryGetMetaFromRemy(fetchedSong, "Jubeat");
            const jacket = fetchedSong.jacketUrl
              ? downloadJacket(
                  fetchedSong.jacketUrl,
                  `jubeat/beyond_the_ave/${fetchedSong.saHash}`,
                )
              : "";

            const newSong: Song = {
              name: fetchedSong.name,
              artist: fetchedSong.artist || "",
              folder: existingData.meta.folders?.at(-1),
              saHash: fetchedSong.saHash,
              bpm: fetchedSong.bpm || "???",
              charts: fetchedSong.charts,
              remyLink: fetchedSong.remyLink,
              jacket,
              flags: ["licensed"],
            };
            existingData.songs.push(newSong);
          }
        }
        setStatus("Done");
        setTitle(
          `Licensed songs from e-amusement GATE: ${licensedSongs.length}`,
        );
      }),
      task("Original songs", async ({ setStatus, setTitle, task }) => {
        // Fetch original songs
        setStatus("Fetching original songs from e-amusement GATE...");
        const originalImporter = new SongImporter(originalSongUrl);
        const originalSongs = await originalImporter.fetchSongs(task);

        // Process original songs
        setStatus("Processing all original songs...");
        for (const fetchedSong of originalSongs as ((typeof originalSongs)[number] &
          Partial<Song>)[]) {
          const existingSong = existingData.songs.find((s) =>
            originalImporter.songEquals(s, fetchedSong),
          );

          if (existingSong) {
            await tryGetMetaFromRemy(existingSong, "Jubeat");
            originalImporter.merge(existingSong, fetchedSong);
            updateSongFlags(existingSong, "holds");
          } else {
            console.log(`Adding new original song: ${fetchedSong.name}`);
            await tryGetMetaFromRemy(fetchedSong, "Jubeat");
            const jacket = fetchedSong.jacketUrl
              ? downloadJacket(
                  fetchedSong.jacketUrl,
                  `jubeat/beyond_the_ave/${fetchedSong.saHash}`,
                )
              : "";

            const newSong: Song = {
              name: fetchedSong.name,
              artist: fetchedSong.artist || "",
              folder: existingData.meta.folders?.at(-1),
              saHash: fetchedSong.saHash,
              bpm: fetchedSong.bpm || "???",
              charts: fetchedSong.charts,
              remyLink: fetchedSong.remyLink,
              jacket,
            };
            existingData.songs.push(newSong);
          }
        }
        setStatus("Done");
        setTitle(
          `Original songs from e-amusement GATE: ${originalSongs.length}`,
        );
      }),
    ]);

    await requestQueue.onIdle();

    // Remove empty flags from song objects before persisting.
    for (const song of existingData.songs) {
      if (!song.flags || song.flags.length === 0) {
        delete song.flags;
      }
    }

    // Sort songs
    existingData.songs = sortSongs(existingData.songs, existingData.meta);
    await writeJsonData(existingData, targetFile);

    console.log(`Successfully updated ${fileName}.json`);
    console.log(`Total songs in database: ${existingData.songs.length}`);
    setStatus("Done");
  } catch (e) {
    setError(e as Error);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
});
