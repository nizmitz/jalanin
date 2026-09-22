// Single source for the app version shown in the About sheet and embedded in "Lapor data salah"
// issue links from popups (src/layers/manager.ts) — set from package.json by vite.config.ts.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
