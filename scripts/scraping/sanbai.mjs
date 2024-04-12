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

export async function getSanbaiData() {
  return require("./songdata.mjs");
}
