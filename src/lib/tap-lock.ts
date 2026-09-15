/**
 * Tap-lock handler: prevents rapid second taps on card grids
 * from landing on newly-mounted interactive elements on destination pages.
 */
export function initTapLock() {
  if (typeof window === "undefined") return;

  let lockUntil = 0;
  window.addEventListener(
    "click",
    (e) => {
      const now = Date.now();
      if (now < lockUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const target = (e.target as HTMLElement | null)?.closest(
        'a[href*="/anime/"], [data-card-press], .card-pressable',
      );
      if (target) {
        lockUntil = now + 200;
      }
    },
    true,
  );
}
