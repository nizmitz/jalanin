export type ReleaseWakeLock = () => void;

// Requests a screen wake lock and keeps it alive across tab-hide/show cycles (Chrome/Android
// release the lock whenever the tab is backgrounded, e.g. the phone auto-locks mid-walk).
// Resolves to a no-op release when the API is unsupported.
export async function acquireWakeLock(): Promise<ReleaseWakeLock> {
  // lib.dom types navigator.wakeLock as always present; feature-detect for real by widening
  // the type back to optional rather than trusting that guarantee.
  const maybeWakeLock = navigator.wakeLock as WakeLock | undefined;
  if (!maybeWakeLock) return () => {};
  const lock: WakeLock = maybeWakeLock;

  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  async function request(): Promise<void> {
    try {
      const acquired = await lock.request('screen');
      if (released) {
        // Follow mode stopped while this request was in flight: don't keep the lock.
        void acquired.release();
        return;
      }
      sentinel = acquired;
      // The browser can release the lock on its own (tab backgrounded, screen off) without
      // going through our release() below — track that so onVisibilityChange knows to re-acquire.
      acquired.addEventListener('release', () => {
        if (sentinel === acquired) sentinel = null;
      });
    } catch {
      sentinel = null;
    }
  }

  await request();

  function onVisibilityChange(): void {
    if (released || document.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    void request();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    const held = sentinel;
    sentinel = null;
    if (held) void held.release();
  };
}
