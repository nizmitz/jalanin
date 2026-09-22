// Shared modal-dialog behaviour for every bottom sheet (the layer panel, the "more" sheet):
// keeping keyboard/AT focus inside the dialog while it's open.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hidden,
  );
}

// Cycles Tab/Shift+Tab within `container`'s focusable elements instead of letting focus escape
// into the page behind the open dialog.
export function trapTabKey(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const focusable = focusableElements(container);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const atEdge = !container.contains(document.activeElement);
  if (e.shiftKey) {
    if (atEdge || document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    }
  } else if (atEdge || document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
}

const INERT_SUPPORTED = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

interface HiddenSibling {
  el: HTMLElement;
  hadAriaHidden: boolean;
}

// Makes everything outside `target`'s ancestor chain (up to <body>) unreachable to keyboard and
// assistive tech while a modal dialog is open — the map, top bar, and FAB stack included,
// whatever their exact DOM position relative to the dialog. Uses the native `inert` attribute
// where supported, `aria-hidden` as a fallback (and always, since `inert` alone isn't reliably
// announced by every AT). Returns a function that restores everything it touched.
export function hideBackground(target: HTMLElement): () => void {
  const hidden: HiddenSibling[] = [];
  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (parent) {
      for (const child of Array.from(parent.children)) {
        if (child === node || !(child instanceof HTMLElement)) continue;
        hidden.push({ el: child, hadAriaHidden: child.hasAttribute('aria-hidden') });
        if (INERT_SUPPORTED) (child as HTMLElement & { inert: boolean }).inert = true;
        child.setAttribute('inert', '');
        child.setAttribute('aria-hidden', 'true');
      }
    }
    node = parent;
  }
  return () => {
    for (const { el, hadAriaHidden } of hidden) {
      if (INERT_SUPPORTED) (el as HTMLElement & { inert: boolean }).inert = false;
      el.removeAttribute('inert');
      if (!hadAriaHidden) el.removeAttribute('aria-hidden');
    }
  };
}
