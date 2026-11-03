// The native app updates through the App Store / TestFlight, so there is nothing to check here.
// app-update.web.ts does the check for the home-screen web app.

export async function isUpdateAvailable(): Promise<boolean> {
  return false;
}

export function applyUpdate(): void {}
