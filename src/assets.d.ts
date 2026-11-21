declare module "*?worker&url" {
  const assetUrl: string;
  export default assetUrl;
}
declare module "*.wasm?url&no-inline" {
  const url: string;
  export default url;
}

interface ImportMeta {
  readonly env: { readonly VITE_RNNOISE_RAW_WORKER?: string };
}
