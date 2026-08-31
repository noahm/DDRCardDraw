export const UNPLAYABLE_IDS = [
  840, // Grace's Tutorial https://remywiki.com/GRACE-chan_no_chou~zetsu!!_GRAVITY_kouza_w
  1219, // Maxima's Tutorial https://remywiki.com/Maxima_sensei_no_mankai!!_HEAVENLY_kouza
  1259, // AUTOMATION PARADISE
  1438, // AUTOMATION PARADISE, April Fools
  1490, // MAX BURNING!! (FOR INFINITE EXTENDED VERSION), Automation Paradise/Megamix Exclusive
  1491, // Zusammenbruch of Gott, Automation Paradise/Megamix Exclusive
  1751, // EXCEED GEAR April Fools https://remywiki.com/Exceed_kamen-chan_no_chotto_issen_wo_exceed_shita_EXCEED_kouza

  1455, // Aug 26th Song removal 回レ！雪月花 (Heart's Cry Remix)
  1446, // Aug 26th Song removal 太陽曰く燃えよカオス (Sol oscuro ¡Nya! Mix)
];

/**
 * @typedef ChartType
 * @type {"novice"|"advanced"|"exhaust"|"infinite"|"maximum"|"gravity"|"heavenly"|"vivid"|"exceed"|"ultimate"|"nabla"}
 */

/**
 * @type {Record<string, Array<number | [number, ChartType]>>}
 * Specifies specific songs or charts which are unlocked via various events.
 * Each event has an array of song IDs or charts (specified as a tuple of song
 * id and chart type) that should be flagged as part of that particular event.
 */
export const SDVX_UNLOCK_IDS = {
  omegaDimension: [
    // EXAMPLES:
    // to flag all charts of WHITEOUT, put its id here:
    // 1100,
    // or, to flag only a particular chart, wrap in braces,
    // then specify the chart afterwards:
    // [1100, "exceed"],

    // Hexadiver
    1580, // 666
    1581, // 色を喪った街
    1582, // ЯeviveR
    1583, // 9TH5IN
    1585, // Katharsis
    1586, // ZEИITH
    1587, // SAMURAI TIGER

    1584, // VVelcome!!
    1588, // Redshift 2nd Ignition
    1589, // ミュージックプレイヤー
    1590, // 春告胡蝶
    1591, // †:OLPHEUX:†
    1592, // GEMINI LA2ER
    1593, // LubedeR
    1594, // Яe:son D'être

    1660, // MAYHEM
    1661, // 飄える翼追い掛けて
    1662, // Calamity Tempest
    1663, // Daisycutter
    1664, // ΛΛemoria
    1665, // With It This Heaven?
    1666, // apo:llioth

    1766, // XHRONOXAPSULΞ
    1768, // EncorE & cALL
    1769, // AμreoLe ~for Triumph~
    1770, // ZEUS
    1774, // All for One
    1775, // Wings to fly high
    1776, // AIM HIGHER

    1767, // MixxioN
    1771, // Xb10r
    1772, // 十の試練
    1773, // Rhapsody ⚙︎f Triumph
    1777, // 火狐之舞
    1778, // 蝕
    1779, // refluxio

    1889, // Bl∞min'
    1891, // LaμreLs ~the Angelus~
    1893, // Avalanx
    1895, // すべてが幻になった後で
    1896, // Grandeur
    1897, // Stairway to the sun
    1900, // 極夜、暁を望んで

    1888, // いまきみに
    1890, // Fαtα∠ Ent∠mEnt
    1892, // VɅZiLiSQ
    1894, // 赫焉
    1898, // STIGMA
    1899, // 光風霽月
    1901, // Lost Parliament

    2037, // APØCALYPSE RAY
    2039, // Spectacular“V”Adventure!
    2040, // Breakneck Pursuit
    2044, // 忘れないように、失くさないように
    2046, // Marielle
    2047, // ΣMERGENCY CODΣ
    2050, // BLISS

    2038, // HeaveИ's Rain
    2041, // and After the Merry BADEND
    2042, // Undead Raving Scare
    2043, // Enter The Rave
    2045, // SHARK IMPACT
    2048, // 十三不塔
    2049, // リュミレイラ

    2079, // TOKAKU=ALMiRAJ
    2080, // レインボウ・フレーバー
    2081, // =∴NOMADE∵OTION=
    2082, // 随神
    2083, // OVEЯ+TUЯE
    2084, // Burst Λnd reBoost
    2085, // Λkasha

    2086, // JACK -the KING Ki11ing-
    2087, // Don't you dare play GOD
    2088, // Xinca
    2089, // 憧憬のファンファーレ
    2090, // Imitated Visions
    2091, // こどもかくしのアンダーランド
    2092, // すべてを賭して

    2253, // KINGDOM COME
    2254, // // If Summer Ever Comes_
    2255, // ØVER《Δ》
    2256, // オムニシエント・ゼロ
    2257, // Lollipop Error 404
    2258, // カミツレの成り方
    2259, // Grαnd Arχitect

    // BPL S2 Blaster Gate
    1939, // DEUX EX MĀXHINĀ
    1940, // All We Need is HAPPY END!!!
    1941, // Glory of Fighters
    1942, // MILITARY R04D
    1943, // WINNING ROAD
    1944, // Paradigm Shift
    1945, // Thousand Triggers
    1946, // Initiating League
    1947, // Petit espoir
    1948, // ENDGAME
    1949, // MURASAME
    1950, // イグノアザーズ
    1951, // ИADIR
    1952, // Chat perché
    1953, // Fl0ating:
    1954, // trea→journey
    1955, // 最果ての勇者にラブソングを
    1956, // Ice Fortress
    1957, // 灼ナル刃、破カヰ譜
    1958, // Scat Jazz Dance

    // BPL Season 2 Stamp Event Blaster Gate
    1919, // HALO
    1920, // S(TAR)²☆pistol
    1921, // 赫焉のヴァルキュリア -Ragnarøk-
    1922, // CUDDLIE CUDDLIE
    1923, // Brave Power Leader 《 = Voltage = 》
    1924, // 零天視
    1925, // ステラ・イミグレーション
    1926, // Garland
    1938, // SuddeИDeath

    // BPL S3 Blaster Gate
    2129, // We Are All The Dreamer
    2130, // Double or Nothing
    2131, // Crawl Out Immortal
    2132, // トリコエリヌム▽コンチェルト
    2133, // 群青纏う朱の槍
    2134, // CHOVERY GOOSE!!!
    2135, // V!LLA!N
    2136, // TOYBOX CANNØN=͟͟͞ Σ≡=｡ﾟ:*.:+｡.☆
    2137, // ON THE WORLD
    2138, // 花火のおもちゃ箱
    2139, // イグジスター
    2140, // La Nostra Storia!
    2141, // グリーディ・スターズ！
    2142, // Di-Da-De-Doo
    2143, // Break Through Δpex
    2144, // LOVE TONIC
    2145, // Inevitable Magic
    2146, // Ars Magna
    2147, // 異次元の孤独～カナタノキミヘ～
    2148, // SΛMVICΛ
    2149, // MΔX FLAVØR
    2150, // Cuz we <3 this Game
    2151, // Xeno Gravity
    2152, // NEMSYS ARENA World Hexathlon

    // BPL Season 3 Stamp Event
    2121, // Knew Order
    2122, // Ex concordia felicitas
    2123, // Allegro Saetta
    2124, // ARISE
    2125, // プリュネシエル
    2126, // Colorful Magical Parade
    2127, // NO SURRENDER
    2128, // StellarflightS
    2160, // ウイジン
    2161, // { eXLIPXe }

    // Unlock Chain
    2034, // 無意識レクイエム(cosmobsp mix)

    // TAMANEKO adventure
    2153, // トキノコエト
    2154, // Entropic EnĤαncemEnt
    2155, // Sweetie Beauti Magic
    2156, // 月明りの旅人たち
    2157, // SAD1STIC Я04D
    2158, // XΛLT=ØVER
    2159, // Two of Wonder Lights

    2183, // 閉塞的フレーション
    2185, // 弾幕信仰
    2186, // SUPER HEROINE!!

    2098, // Kool Awesome Croon
    2109, // ØverwriteTheCatastrophe
    2112, // Cumulonimbus
    2117, // ΛNXIENT:LEGΛXIEZ

    2094, // 一水山風
    2097, // Superstar!
    2100, // 鳳凰誓歌
    2107, // 永久の粒虹
    2115, // Lunatic Mare

    2106, // 孤独のドロップハンター
    2108, // MiRÀi
    2110, // reSTART yOUR STORIES
    2113, // ぼくらのはじまりのおと
    2116, // Line markeR

    2198, // Our garden is blue.
    2200, // Golden Rotation
    2201, // Titanomachia
    2202, // Ardenok
    2203, // Jupiter
    2204, // 流転に咲く魂の花

    [774, "exceed"], // neko＊neko XCD
    [450, "exceed"], // VILE CAT XCD
    [44, "exceed"], // 世界はネコのもの XCD

    [650, "exceed"], // Chant du Cygne XCD
    [642, "exceed"], // Sayonara Planet Wars XCD
    [653, "exceed"], // 混乱少女♥そふらんちゃん!! XCD
    [657, "exceed"], // 到達してしまった僕らと夢と希望の最之果 XCD

    [675, "exceed"], // BEAT-NEW-WORLD XCD
    [182, "exceed"], // 待チ人ハ来ズ。 XCD

    // Exceed Gear Arena Exclusive Exceed Charts
    [872, "exceed"], // Din Don Dan (Fusion Remix)
    [88, "exceed"], // Grip & Break down !! - SDVX Edit. -
    [64, "exceed"], // SOUL EXPLOSION
    [332, "exceed"], // crazy cinema story
    [871, "exceed"], // The star in eclipse
    [711, "exceed"], // ちくわパフェだよ☆ＣＫＰ
    [633, "exceed"], // 2 MINUTES FIGHTERS
    [381, "exceed"], // HYENA

    [111, "exceed"], // 地球最後の告白を
    [132, "exceed"], // 色は匂へど散りぬるを
    [239, "exceed"], // Foolish Hero
    [37, "exceed"], // neu BSP style
    [632, "exceed"], // Invitation from Mr.C

    [8, "exceed"], // smooooch・∀・ KN mix
    [323, "exceed"], // マネマネサイコトロピック
    [612, "exceed"], // Le Fruit Défendu
    [131, "exceed"], // 物凄い勢いでけーねが物凄いうた
    [342, "exceed"], // Fiat Lux
    [787, "exceed"], // Candy Colored Hearts
    [790, "exceed"], // EMPIRE OF FLAME
    [789, "exceed"], // End to end
    [788, "exceed"], // NEO GRAVITY
    [610, "exceed"], // veRtrageS
    [786, "exceed"], // 雲の彼方

    [842, "exceed"], // B.B.K.K.B.K.K.
    [510, "exceed"], // The Sampling Paradise (P*Light Remix)
    [281, "exceed"], // ネトゲ廃人シュプレヒコール

    [165, "exceed"], // Hello world!
    [634, "exceed"], // LegenD.
    [348, "exceed"], // ボルテ体操第一

    [241, "exceed"], // Lieselotte
    [289, "exceed"], // U.N.オーエンは彼女なのか？haru_naba Remix
    [390, "exceed"], // 轟け！恋のビーンボール！！

    [85, "exceed"], // dreamin' feat.Ryu☆
    [635, "exceed"], // World's end
    [389, "exceed"], // デッドボヲルdeホームラン

    [779, "exceed"], // conflict
    [225, "exceed"], // Next infection
    [418, "exceed"], // werewolf howls.

    [61, "exceed"], // レトロスペクティビリー・メリーゴーランド
    [466, "exceed"], // 有頂天ビバーチェ
    [183, "exceed"], // ウサテイ

    [836, "exceed"], // Halcyon
    [475, "exceed"], // SkyDrive!
    [687, "exceed"], // Sounds Of Summer

    // BPL S5 Blaster GATE
    2314, // Divine Ether
    2315, // #Evil_Signs_of_Bloodlines
    2316, // Blessed Horizon
    2317, // 双星の冒険録
    2318, // ИEXTAGE
    2319, // CAKE,Cake'n Cake!
    2320, // 天鯨譚
    2321, // 華麗なる一撃
    2322, // Veins Resonance
    2323, // ShowDawn
    2324, // DANGER XLOZE
    2325, // XELENOPHOEBEA
    2326, // Down with your Love
    2327, // Circumzenith Arc
  ],

  // Variant Gate
  variantgate: [
    //Variant Gate 1
    2199, // 神凪
    2225, // 黒蝶のワルツ
    2226, // Gryphone
    2227, // Who then no 灯

    //Variant Gate 2
    [272, "exceed"], // I'm so Happy XCD
    [315, "exceed"], // 恋はどう？モロ◎波動OK☆方程式！！ XCD
    [699, "exceed"], // ΕΛΠΙΣ XCD
    [271, "exceed"], // VALLIS-NERIA XCD
    [636, "ultimate"], // Everlasting Message ULT
  ],

  otherEvents: [
    // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe 0
    2246, // EROICA
    2247, // Secret Rouge
    2249, // Snow Garland Fairy
    2250, // EYE OF THE HEAVEN
    2263, // Electronic Sports Complex

    // BEMANI PRO LEAGUE -SEASON 5- Triple Tribe
    2358, // 9th Outburst
    2359, // Anti-Matter
    2360, // Mermaid girl
    2361, // Glitch N Ride
    2362, // fixer
    2378, // Thunderstorm
    2380, // Roar of Chronos
    2382, // RUINA

    // ぼる×りこ Cross Resonance
    2231, // Crossfade
    2232, // 星界のアルペジオ
    2233, // Ö<3rf10₩

    2260, // ぐしゃ
    2261, // Dear Deer
    2262, // DISTORDER

    2284, // HOLOGRAPHY
    2285, // Like the Starlight
    2286, // FRENZY HEART

    2339, // フラッフィー・アドベンチャー！
    2340, // Temporal Veil
    2341, // 555 (Please call me “Go! Go! Go!”)

    2370, //Moonlit Blue
    2371, //シグナライズ
    2372, //Baphomet

    // GITADORA Special Stamp!
    2342, // めた・メタ？ひまわり＊パンチ
    2338, // 天泣

    // Seiryu Kai Stamp Bonus!
    2170, // Blue Diamond

    // BEMANI PRO LEAGUE -SEASON 5- Special Stamp
    2328, // ASTRL GG
    2329, // Masterstroke
    2330, // KISKIL-LILLA
    2331, // No→to
    2363, // RIZING-GAMERS.
    2364, // King of Tribe
    2365, // SILKY BRAVE
    2366, // GO!
    2367, // Astra Blaze
    2368, // HORIZON BEATZ
    2369, // Meteor☆Shower
    2383, // COLOR BURST

    // pop'n & SDVX Cheers × Cheers!!
    2355, // Zt!ri△
    2356, // Votum stellarum -forest #25 RMX-
    2357, // 紅焔

    // NABLA Arena Exclusive Nabla Charts
    [353, "nabla"], // BUBBLE RAVER
    [152, "nabla"], // Earthquake Super Shock - SDVX Edit. -
    [623, "nabla"], // False Cross
    [770, "nabla"], // ハッピーシンセサイザ
    [697, "nabla"], // 初音ミクの消失
  ],

  jpOnly: [
    // Chase Chase Jokers J-Region Exclusive
    2027, // チェイスチェイスジョーカーズのうた

    // Tetoris
    2216, //テトリス
  ],
};
