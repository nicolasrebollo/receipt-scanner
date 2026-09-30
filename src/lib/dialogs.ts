import { Alert } from 'react-native';

// Native dialogs. dialogs.web.ts provides the browser equivalents (Alert is a no-op on web).

export function showMessage(title: string, message?: string) {
  Alert.alert(title, message);
}

export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(opts.title, opts.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmLabel,
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]),
  );
}

export function promptText(opts: { title: string; message?: string; defaultValue?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    Alert.prompt(
      opts.title,
      opts.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Save', onPress: (value?: string) => resolve(value ?? null) },
      ],
      'plain-text',
      opts.defaultValue,
    ),
  );
}

export function chooseOption(opts: { title: string; options: string[]; current?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    Alert.alert(opts.title, undefined, [
      ...opts.options.map((o) => ({ text: o === opts.current ? `${o} ✓` : o, onPress: () => resolve(o) })),
      { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
    ]),
  );
}
