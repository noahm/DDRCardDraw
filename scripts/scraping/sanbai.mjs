/**
 *
 * @param {number} difficulty
 * @param {string} style
 * @returns {Promise<Record<string, { tier: number, rating: number }>>}
 */
export async function getDifficultyList(difficulty, style) {
  let url = `https://3icecream.com/difficulty_list/${difficulty}`;
  if (style === "double") {
    url += "?spdp=1";
  }
  const resp = await fetch(url);
  const body = await resp.text();
  const difficultyListMatch = body.match(/let difficultyList = (\{.+\});/);
  if (difficultyListMatch) {
    return JSON.parse(difficultyListMatch[1]);
  }
}

const titleList = [
  { name: "DanceDanceRevolution World" },
  { name: "DanceDanceRevolution A3" },
  { name: "DanceDanceRevolution A20 PLUS" },
  { name: "DanceDanceRevolution A20" },
  { name: "DanceDanceRevolution A" },
  { name: "DanceDanceRevolution (2014)" },
  { name: "DanceDanceRevolution (2013)" },
  { name: "DanceDanceRevolution X3 vs 2nd MIX" },
  { name: "DanceDanceRevolution X2" },
  { name: "DanceDanceRevolution X" },
  { name: "DanceDanceRevolution SuperNOVA2" },
  { name: "DanceDanceRevolution SuperNOVA" },
  { name: "DanceDanceRevolution EXTREME" },
  { name: "DDRMAX2 -DanceDanceRevolution 7thMIX-" },
  { name: "DDRMAX -DanceDanceRevolution 6thMIX-" },
  { name: "DanceDanceRevolution 5th Mix" },
  { name: "DanceDanceRevolution 4th Mix" },
  { name: "DanceDanceRevolution 3rd Mix" },
  { name: "DanceDanceRevolution 2nd Mix" },
  { name: "DanceDanceRevolution 1st Mix" },
].toReversed();

export async function getSanbaiData() {
  return require("./songdata.mjs");
}
