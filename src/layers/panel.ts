import { hideBackground, trapTabKey } from '../dialog';
import { t } from '../i18n';
import type { Lang, StringKey } from '../i18n';
import type { FeatureCollection } from 'geojson';
import type { LayerDef, LayerGroup } from './types';

export interface LayerPanelOptions {
  lang: Lang;
  enabled: Set<string>;
  defs: readonly LayerDef[];
  onToggle: (id: string, on: boolean) => void;
  onClose: () => void;
}

export interface LayerPanel {
  setLang(lang: Lang): void;
  open(): void;
  close(): void;
}

const GROUP_ORDER: readonly LayerGroup[] = ['rules', 'transit', 'road', 'hazard'];

const GROUP_TITLE_KEY: Record<LayerGroup, StringKey> = {
  rules: 'groupRules',
  transit: 'groupTransit',
  road: 'groupRoad',
  hazard: 'groupHazard',
};

// Non-standard but deliberate: a FeatureCollection literal (never a lazy thunk, which can't be
// inspected synchronously) may carry a top-level `properties.data_as_of` for the panel to show.
type FeatureCollectionWithMeta = FeatureCollection & { properties?: { data_as_of?: string } };

function dataAsOf(def: LayerDef): string | undefined {
  if (typeof def.data === 'function') return undefined;
  return (def.data as FeatureCollectionWithMeta).properties?.data_as_of;
}

function defsInGroup(defs: readonly LayerDef[], group: LayerGroup): LayerDef[] {
  return defs
    .filter((def) => def.group === group)
    .sort((a, b) => (a.id === 'gage' ? -1 : 0) - (b.id === 'gage' ? -1 : 0));
}

export function mountLayerPanel(root: HTMLElement, opts: LayerPanelOptions): LayerPanel {
  let lang = opts.lang;
  let opener: HTMLElement | null = null;
  let restoreBackground: (() => void) | null = null;

  const sheet = document.createElement('div');
  sheet.className = 'sheet layer-panel';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'layer-panel-title');
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="sheet__header">
      <h2 class="sheet__title" id="layer-panel-title"></h2>
      <button type="button" class="sheet__close" data-close></button>
    </div>
    <div class="sheet__body" data-groups></div>
  `;
  root.appendChild(sheet);

  const titleElOrNull = sheet.querySelector<HTMLHeadingElement>('.sheet__title');
  const closeBtnOrNull = sheet.querySelector<HTMLButtonElement>('[data-close]');
  const groupsElOrNull = sheet.querySelector<HTMLDivElement>('[data-groups]');
  if (!titleElOrNull || !closeBtnOrNull || !groupsElOrNull) {
    throw new Error('layer panel markup missing an element');
  }
  // Reassigned to non-nullable bindings so the closures below (which TS can't narrow across
  // function boundaries) don't need a non-null assertion on every access.
  const titleEl: HTMLHeadingElement = titleElOrNull;
  const closeBtn: HTMLButtonElement = closeBtnOrNull;
  const groupsEl: HTMLDivElement = groupsElOrNull;

  function renderRow(def: LayerDef): HTMLElement {
    const row = document.createElement('label');
    row.className = 'layer-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = opts.enabled.has(def.id);
    checkbox.addEventListener('change', () => {
      opts.onToggle(def.id, checkbox.checked);
    });
    row.appendChild(checkbox);

    const name = document.createElement('span');
    name.className = 'layer-row__name';
    name.textContent = t(def.labelKey, lang);
    row.appendChild(name);

    if (def.legend && def.legend.length > 0) {
      const legend = document.createElement('span');
      legend.className = 'layer-row__legend';
      for (const entry of def.legend) {
        const swatch = document.createElement('span');
        swatch.className = 'layer-row__swatch';
        swatch.style.backgroundColor = entry.colour;
        if (entry.dashed) swatch.style.borderStyle = 'dashed';
        swatch.title = t(entry.labelKey, lang);
        legend.appendChild(swatch);
      }
      row.appendChild(legend);
    }

    const asOf = dataAsOf(def);
    if (asOf) {
      const small = document.createElement('small');
      small.className = 'layer-row__asof';
      small.textContent = `Data: ${asOf}`;
      row.appendChild(small);
    }

    return row;
  }

  function render(): void {
    titleEl.textContent = t('layers', lang);
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', t('close', lang));
    groupsEl.replaceChildren();
    for (const group of GROUP_ORDER) {
      const defs = defsInGroup(opts.defs, group);
      if (defs.length === 0) continue;
      const section = document.createElement('section');
      section.className = 'layer-group';
      const heading = document.createElement('h3');
      heading.className = 'layer-group__title';
      heading.textContent = t(GROUP_TITLE_KEY[group], lang);
      section.appendChild(heading);
      for (const def of defs) section.appendChild(renderRow(def));
      groupsEl.appendChild(section);
    }
  }

  function close(): void {
    sheet.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    restoreBackground?.();
    restoreBackground = null;
    opener?.focus();
    opener = null;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      opts.onClose();
      return;
    }
    trapTabKey(sheet, e);
  }

  closeBtn.addEventListener('click', () => {
    close();
    opts.onClose();
  });

  function open(): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    sheet.hidden = false;
    restoreBackground = hideBackground(sheet);
    document.addEventListener('keydown', onKeydown);
    closeBtn.focus();
  }

  render();

  return {
    setLang(next) {
      lang = next;
      render();
    },
    open,
    close,
  };
}
