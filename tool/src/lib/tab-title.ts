/**
 * Tab title flash utility.
 * Alternates document.title to draw attention when a phase completes
 * while the user is on a different tab.
 */

let originalTitle: string | null = null;
let flashInterval: ReturnType<typeof setInterval> | null = null;
let focusHandler: (() => void) | null = null;

/**
 * Flash the browser tab title between the given message and the original title.
 * Automatically stops when the window regains focus.
 */
export function flashTitle(message: string): void {
  if (typeof document === "undefined") return;

  // Don't flash if window is already focused
  if (document.hasFocus()) return;

  stopFlash();

  originalTitle = document.title;
  let showMessage = true;

  flashInterval = setInterval(() => {
    document.title = showMessage ? message : (originalTitle ?? "RFP Copilot");
    showMessage = !showMessage;
  }, 1500);

  // Stop flashing when user focuses the window
  focusHandler = () => stopFlash();
  window.addEventListener("focus", focusHandler);
}

/**
 * Stop flashing and restore the original title.
 */
export function stopFlash(): void {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }

  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }

  if (focusHandler) {
    window.removeEventListener("focus", focusHandler);
    focusHandler = null;
  }
}
