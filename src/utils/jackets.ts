export function getJacketUrl(jacketFromData: string) {
  // Published bundles (ITG packs) carry absolute CDN urls into the
  // content-addressed jacket pool; bundled stock data uses relative paths.
  if (jacketFromData.startsWith("http")) {
    return jacketFromData;
  }
  const prefix = jacketFromData.startsWith("blob:") ? "" : "/jackets/";
  return `${prefix}${jacketFromData}`;
}
