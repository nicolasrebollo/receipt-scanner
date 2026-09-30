import { useColorScheme } from 'react-native';

import { useTheme } from '@/constants/theme';

/** Browser version of DateField: a native <input type="date">, which Safari shows as its own picker. */
export function DateField({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        fontSize: 17,
        color: theme.text,
        backgroundColor: theme.fill,
        colorScheme: scheme === 'dark' ? 'dark' : 'light',
        border: 'none',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    />
  );
}
