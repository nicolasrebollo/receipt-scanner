import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const textVariants = StyleSheet.create({
  hero: { fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
});

type TextTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onAccent';

export function AppText({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: TextProps & { variant?: keyof typeof textVariants; tone?: TextTone }) {
  const theme = useTheme();
  const color = {
    primary: theme.text,
    secondary: theme.textSecondary,
    muted: theme.textMuted,
    accent: theme.accent,
    danger: theme.danger,
    onAccent: theme.accentText,
  }[tone];
  return <Text style={[textVariants[variant], { color }, style]} {...props} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  title,
  accessory,
  children,
  contentStyle,
  onRefresh,
  ...scrollProps
}: ScrollViewProps & {
  title?: string;
  accessory?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => Promise<unknown>;
}) {
  const theme = useTheme();
  const refresh = useRefresh(onRefresh);
  return (
    <ScrollView
      refreshControl={refresh}
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {...scrollProps}
      contentContainerStyle={[styles.screenContent, contentStyle]}>
      {title ? <ScreenTitle title={title} accessory={accessory} /> : null}
      {children}
    </ScrollView>
  );
}

/** Pull-to-refresh control that spins until `onRefresh` settles. */
export function useRefresh(onRefresh?: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  if (!onRefresh) return undefined;
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await onRefresh().finally(() => setRefreshing(false));
      }}
    />
  );
}

export function ScreenTitle({ title, accessory }: { title: string; accessory?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <AppText variant="largeTitle" accessibilityRole="header">
        {title}
      </AppText>
      {accessory}
    </View>
  );
}

/** Cancel / title / Save bar for modal screens. */
export function ModalHeader({
  title,
  onCancel,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  saving,
}: {
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.modalHeader, { backgroundColor: theme.background, borderBottomColor: theme.separator }]}>
      <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12} style={styles.modalSide}>
        <Text style={[textVariants.body, { color: theme.accent }]}>Cancel</Text>
      </Pressable>
      <AppText variant="headline" numberOfLines={1}>
        {title}
      </AppText>
      <View style={[styles.modalSide, { alignItems: 'flex-end' }]}>
        {saving ? (
          <ActivityIndicator />
        ) : onSave ? (
          <Pressable accessibilityRole="button" onPress={onSave} disabled={saveDisabled} hitSlop={12}>
            <Text style={[textVariants.headline, { color: theme.accent, opacity: saveDisabled ? 0.35 : 1 }]}>
              {saveLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card }, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="footnote" tone="secondary" style={styles.sectionHeaderText}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

export function Separator({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: inset }} />
  );
}

export function Icon({
  name,
  size = 20,
  color,
  weight = 'medium',
}: {
  name: SFSymbol;
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  const theme = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? theme.text} weight={weight} />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: SFSymbol;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = { primary: theme.accent, secondary: theme.fill, plain: 'transparent', destructive: theme.fill }[
    variant
  ];
  const fg = {
    primary: theme.accentText,
    secondary: theme.text,
    plain: theme.accent,
    destructive: theme.danger,
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} weight="semibold" /> : null}
          <Text style={[textVariants.headline, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  disabled,
}: {
  icon: SFSymbol;
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.fill, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}>
      <Icon name={icon} size={15} weight="semibold" />
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: SFSymbol;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.text : theme.card, opacity: pressed ? 0.7 : 1 },
      ]}>
      {icon ? <Icon name={icon} size={14} color={selected ? theme.background : theme.text} /> : null}
      <Text
        style={[
          textVariants.subhead,
          { color: selected ? theme.background : theme.text, fontWeight: '500' },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.fill }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={[styles.segment, selected && [styles.segmentSelected, { backgroundColor: theme.card }]]}>
            <Text
              style={[textVariants.footnote, { color: theme.text, fontWeight: selected ? '600' : '500' }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ‹ label › control for stepping through days, months, years. */
export function Stepper({
  label,
  onPrev,
  onNext,
  nextDisabled,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="chevron.left" label="Previous" onPress={onPrev} />
      <AppText variant="headline" style={styles.stepperLabel} numberOfLines={1}>
        {label}
      </AppText>
      <IconButton icon="chevron.right" label="Next" onPress={onNext} disabled={nextDisabled} />
    </View>
  );
}

export function TextField({
  label,
  style,
  ...props
}: TextInputProps & { label?: string; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <AppText variant="footnote" tone="secondary">
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[styles.input, textVariants.body, { color: theme.text, backgroundColor: theme.card }, style]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: SFSymbol; title: string; message?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={36} color={theme.textMuted} weight="regular" />
      <AppText variant="headline">{title}</AppText>
      {message ? (
        <AppText variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2, gap: Spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalSide: { width: 80 },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, borderCurve: 'continuous' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: { textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500' },
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  iconButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 8 },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepperLabel: { flex: 1, textAlign: 'center' },
  field: { gap: 6 },
  input: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl * 1.5,
    paddingHorizontal: Spacing.xl,
  },
});
