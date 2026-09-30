import DateTimePicker from '@react-native-community/datetimepicker';

import { parseISODate, toISODate } from '@/lib/dates';

/** Compact iOS date picker bound to a "YYYY-MM-DD" string. date-field.web.tsx is the browser version. */
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
  return (
    <DateTimePicker
      value={parseISODate(value)}
      mode="date"
      display="compact"
      minimumDate={min ? parseISODate(min) : undefined}
      maximumDate={max ? parseISODate(max) : undefined}
      onChange={(_, date) => date && onChange(toISODate(date))}
    />
  );
}
