import './style.css';
import { dayKind, isGageActive, jakartaTime, verdict } from './gage';
import { HOLIDAYS } from './holidays';
import { addGageLayers, roadState, setGageState } from './gage-layer';
import { addAttribution, applyTheme, createMap } from './map';
import { getLang, getParity, getTheme, setLang, setParity, setTheme } from './store';
import { mountUi } from './ui';
import type { Theme } from './theme';
import type { DayKind, Parity } from './gage';

const STATUS_POLL_MS = 30_000;

const app = document.getElementById('app');
if (!app) throw new Error('missing #app element');

const mapEl = document.createElement('div');
mapEl.className = 'map';
const uiEl = document.createElement('div');
app.append(mapEl, uiEl);

let theme: Theme = getTheme();
let parity: Parity = getParity();
let lang = getLang();

document.documentElement.dataset.theme = theme;

const map = createMap(mapEl, theme);
addAttribution(map);

function currentState(): {
  state: ReturnType<typeof roadState>;
  verdict: ReturnType<typeof verdict>;
  active: boolean;
  day: DayKind;
} {
  const now = new Date();
  const v = verdict(parity, now, HOLIDAYS);
  const active = isGageActive(now, HOLIDAYS);
  const day = dayKind(jakartaTime(now), HOLIDAYS);
  return { state: roadState(v, active), verdict: v, active, day };
}

// 'style.load' fires for the initial style and after every applyTheme().
map.on('style.load', () => {
  addGageLayers(map, currentState().state, theme);
});

let followOn = false;

const ui = mountUi(uiEl, {
  initial: { parity, theme, lang },
  onParity(p) {
    parity = p;
    setParity(p);
    const { state, verdict: v, active, day } = currentState();
    setGageState(map, state);
    ui.setStatus(v, active, day);
    ui.setParity(p);
  },
  onFollow() {
    // GPS wiring lands in Task 9; for now the button only reflects pressed state.
    followOn = !followOn;
    ui.setFollow(followOn);
  },
  onTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    document.documentElement.dataset.theme = theme;
    applyTheme(map, theme);
    ui.setTheme(theme);
  },
  onLang() {
    lang = lang === 'id' ? 'en' : 'id';
    setLang(lang);
    ui.setLang(lang);
    const { verdict: v, active, day } = currentState();
    ui.setStatus(v, active, day);
  },
});

{
  const { verdict: v, active, day } = currentState();
  ui.setStatus(v, active, day);
}

setInterval(() => {
  const { state, verdict: v, active, day } = currentState();
  setGageState(map, state);
  ui.setStatus(v, active, day);
}, STATUS_POLL_MS);
