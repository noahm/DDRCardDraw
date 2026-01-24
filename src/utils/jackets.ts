export function getJacketUrl(jacketFromData: string) {
  const prefix = jacketFromData.startsWith("blob:") ? "" : "/jackets/";
  return `${prefix}${jacketFromData}`;
}
