declare module "*?worker&url" {
  const assetUrl: string;
  export default assetUrl;
}
declare module "*.wasm?url&no-inline" {
  const url: string;
  export default url;
}
