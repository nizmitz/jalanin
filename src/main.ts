import './style.css';
import { isGageActive, verdict } from './gage';
import { HOLIDAYS } from './holidays';
import { addGageLayers, roadState } from './gage-layer';
import { applyTheme, createMap } from './map';
import { setTheme, systemTheme } from './theme';
import type { Theme } from './theme';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app element');

let theme: Theme = systemTheme();
const map = createMap(app, theme);

function currentRoadState(): ReturnType<typeof roadState> {
  // Parity is hardcoded to 'odd' until Task 8 adds the user-facing toggle.
  const now = new Date();
  return roadState(verdict('odd', now, HOLIDAYS), isGageActive(now, HOLIDAYS));
}

// 'style.load' fires for the initial style and after every applyTheme().
map.on('style.load', () => {
  addGageLayers(map, currentRoadState(), theme);
});

// Temporary: press 'd' to toggle light/dark theme (Task 8 replaces this with a UI button).
window.addEventListener('keydown', (e) => {
  if (e.key !== 'd') return;
  theme = theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  applyTheme(map, theme);
});
