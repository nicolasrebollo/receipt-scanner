// Browser versions of the dialogs in dialogs.ts.

export function showMessage(title: string, message?: string) {
  window.alert(message ? `${title}\n\n${message}` : title);
}

export async function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  return window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title);
}

export async function promptText(opts: {
  title: string;
  message?: string;
  defaultValue?: string;
}): Promise<string | null> {
  return window.prompt(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title, opts.defaultValue);
}

export async function chooseOption(opts: {
  title: string;
  options: string[];
  current?: string;
}): Promise<string | null> {
  const answer = window.prompt(`${opts.title}: ${opts.options.join(', ')}`, opts.current);
  const match = opts.options.find((o) => o.toLowerCase() === answer?.trim().toLowerCase());
  return match ?? null;
}
