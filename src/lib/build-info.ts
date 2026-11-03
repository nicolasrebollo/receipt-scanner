/** When this build was made, e.g. "Nov 2, 3:15 PM"; null in development. Set by `npm run build:web`. */
export function buildLabel(): string | null {
  const raw = process.env.EXPO_PUBLIC_BUILD_TIME;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
