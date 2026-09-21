import { beforeEach, describe, expect, it } from 'vitest';
import { focusableElements, hideBackground, trapTabKey } from '../src/dialog';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.appendChild(root);
});

describe('focusableElements', () => {
  it('finds buttons and inputs, in DOM order', () => {
    root.innerHTML = '<button id="a"></button><input id="b"><span id="c"></span>';
    const found = focusableElements(root).map((el) => el.id);
    expect(found).toEqual(['a', 'b']);
  });

  it('excludes disabled and hidden elements', () => {
    root.innerHTML =
      '<button id="a" disabled></button><button id="b" hidden></button><button id="c"></button>';
    const found = focusableElements(root).map((el) => el.id);
    expect(found).toEqual(['c']);
  });
});

describe('trapTabKey', () => {
  it('Tab on the last element wraps to the first', () => {
    root.innerHTML = '<button id="a"></button><button id="b"></button>';
    const b = root.querySelector<HTMLElement>('#b');
    b?.focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    trapTabKey(root, e);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('a');
  });

  it('Shift+Tab on the first element wraps to the last', () => {
    root.innerHTML = '<button id="a"></button><button id="b"></button>';
    const a = root.querySelector<HTMLElement>('#a');
    a?.focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    trapTabKey(root, e);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('does nothing for keys other than Tab', () => {
    root.innerHTML = '<button id="a"></button><button id="b"></button>';
    const b = root.querySelector<HTMLElement>('#b');
    b?.focus();
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    trapTabKey(root, e);
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement?.id).toBe('b');
  });

  it('pulls focus back in if it somehow lands outside the container', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    root.innerHTML = '<button id="a"></button><button id="b"></button>';
    outside.focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    trapTabKey(root, e);
    expect(document.activeElement?.id).toBe('a');
  });
});

describe('hideBackground', () => {
  it('inerts and aria-hides siblings of the target up to <body>, and restores them', () => {
    root.innerHTML = `
      <div id="wrapper">
        <div id="sibling-1"></div>
        <div id="dialog-host">
          <div id="dialog-sibling"></div>
          <div id="dialog"></div>
        </div>
      </div>
    `;
    const outsideSibling = document.createElement('div');
    outsideSibling.id = 'outside-sibling';
    document.body.appendChild(outsideSibling);

    const dialog = root.querySelector<HTMLElement>('#dialog');
    if (!dialog) throw new Error('missing #dialog');

    const restore = hideBackground(dialog);

    const dialogSibling = root.querySelector('#dialog-sibling');
    const sibling1 = root.querySelector('#sibling-1');
    expect(dialogSibling?.hasAttribute('inert')).toBe(true);
    expect(dialogSibling?.getAttribute('aria-hidden')).toBe('true');
    expect(sibling1?.hasAttribute('inert')).toBe(true);
    expect(outsideSibling.hasAttribute('inert')).toBe(true);
    // The dialog's own ancestor chain (dialog-host, wrapper, root) must stay reachable.
    expect(root.querySelector('#dialog-host')?.hasAttribute('inert')).toBe(false);
    expect(root.hasAttribute('inert')).toBe(false);

    restore();

    expect(dialogSibling?.hasAttribute('inert')).toBe(false);
    expect(dialogSibling?.hasAttribute('aria-hidden')).toBe(false);
    expect(sibling1?.hasAttribute('inert')).toBe(false);
    expect(outsideSibling.hasAttribute('inert')).toBe(false);

    outsideSibling.remove();
  });

  it('leaves a sibling that already had aria-hidden for another reason alone on restore', () => {
    root.innerHTML = '<div id="already-hidden" aria-hidden="true"></div><div id="dialog"></div>';
    const dialog = root.querySelector<HTMLElement>('#dialog');
    if (!dialog) throw new Error('missing #dialog');

    const restore = hideBackground(dialog);
    restore();

    expect(root.querySelector('#already-hidden')?.getAttribute('aria-hidden')).toBe('true');
  });
});
