// A home-screen web app can keep running the version it first loaded until it's fully closed.
// This compares the running app with what's published and lets the person reload into the new one.

const ENTRY_SCRIPT = /\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/;

export async function isUpdateAvailable(): Promise<boolean> {
  const running = [...document.scripts].map((s) => s.src.match(ENTRY_SCRIPT)?.[0]).find(Boolean);
  if (!running) return false; // development server: no hashed bundle to compare
  try {
    const response = await fetch(`/?update-check=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const published = (await response.text()).match(ENTRY_SCRIPT)?.[0];
    return !!published && published !== running;
  } catch {
    return false; // offline: try again next time
  }
}

export function applyUpdate(): void {
  window.location.reload();
}
