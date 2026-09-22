/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Protomaps basemap daily build date (YYYY-MM-DD); 'unknown' until CI wires it in (Task A10-lite
  // ships the data-sources plumbing only — see plan Task A12 for the CI follow-up).
  readonly VITE_BASEMAP_DATE?: string;
  // App version shown in the About sheet; set from package.json by vite.config.ts.
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
