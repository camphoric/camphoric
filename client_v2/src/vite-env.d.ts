/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-server proxy target for /api (the Django backend). */
  readonly VITE_API_PROXY?: string;
  /** Google Maps API key for address autocomplete; optional (DR-23). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
