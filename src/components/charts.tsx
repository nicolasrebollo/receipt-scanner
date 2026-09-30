import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';

export type Bar = {
  key: string;
  /** Full label shown when the bar is tapped, e.g. "Sep 14". */
  label: string;
  /** Short axis label; omit to leave the tick blank. */
  tick?: string;
  value: number;
};

const CHART_HEIGHT = 140;

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= max) ?? 10;
  return step * magnitude;
}

/** Single-series column chart. Tap a column to read its value. */
export function BarChart({
  bars,
  format,
  formatAxis,
}: {
  bars: Bar[];
  format: (n: number) => string;
  formatAxis: (n: number) => string;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const top = niceCeiling(Math.max(0, ...bars.map((b) => b.value)));

  const active = bars.find((b) => b.key === selected);
  const peak = bars.reduce<Bar | null>((best, b) => (b.value > (best?.value ?? 0) ? b : best), null);
  const readout = active ?? peak;

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.readout}>
        <AppText variant="footnote" tone="secondary">
          {active ? active.label : peak ? `Highest · ${peak.label}` : 'No spending'}
        </AppText>
        <AppText variant="headline">{readout ? format(readout.value) : ''}</AppText>
      </View>

      <View>
        <AppText variant="caption" tone="muted" style={styles.axisLabel}>
          {formatAxis(top)}
        </AppText>

        <View style={[styles.plot, { borderBottomColor: theme.gridline }]}>
          <View style={[styles.gridline, { backgroundColor: theme.gridline }]} />
          {bars.map((b) => {
            const isActive = b.key === selected;
            const dimmed = selected !== null && !isActive;
            return (
              <Pressable
                key={b.key}
                accessibilityRole="button"
                accessibilityLabel={`${b.label}: ${format(b.value)}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(isActive ? null : b.key);
                }}
                style={styles.column}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: b.value > 0 ? Math.max(2, (b.value / top) * CHART_HEIGHT) : 0,
                      backgroundColor: theme.accent,
                      opacity: dimmed ? 0.35 : 1,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.ticks}>
          {bars.map((b) => (
            <View key={b.key} style={styles.tickCell}>
              {b.tick ? (
                <View style={styles.tickLabel}>
                  <AppText variant="caption" tone="muted">
                    {b.tick}
                  </AppText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export type BreakdownRow = { key: string; label: string; icon?: SFSymbol; value: number };

/** Ranked horizontal bars showing each row's share of the total. */
export function Breakdown({ rows, format }: { rows: BreakdownRow[]; format: (n: number) => string }) {
  const theme = useTheme();
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const max = Math.max(0, ...rows.map((r) => r.value));

  return (
    <View style={{ gap: Spacing.lg }}>
      {rows.map((r) => {
        const share = total > 0 ? r.value / total : 0;
        return (
          <View
            key={r.key}
            style={{ gap: 6 }}
            accessible
            accessibilityLabel={`${r.label}: ${format(r.value)}, ${Math.round(share * 100)} percent`}>
            <View style={styles.breakdownHeader}>
              {r.icon ? (
                <View style={styles.breakdownIcon}>
                  <Icon name={r.icon} size={16} color={theme.textSecondary} />
                </View>
              ) : null}
              <AppText variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                {r.label}
              </AppText>
              <AppText variant="footnote" tone="muted" style={styles.tabular}>
                {Math.round(share * 100)}%
              </AppText>
              <AppText variant="subhead" style={[styles.tabular, styles.breakdownValue]}>
                {format(r.value)}
              </AppText>
            </View>
            <View style={[styles.track, { backgroundColor: theme.fill }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${max > 0 ? (r.value / max) * 100 : 0}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  gridline: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  axisLabel: { alignSelf: 'flex-end', marginBottom: 4 },
  plot: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 1 },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  ticks: { flexDirection: 'row', marginTop: 6 },
  tickCell: { flex: 1, height: 16, overflow: 'visible' },
  // Centered on the column but wider than it, so labels like "15" never get squeezed.
  tickLabel: { position: 'absolute', left: '50%', width: 40, marginLeft: -20, alignItems: 'center' },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  breakdownIcon: { width: 22, alignItems: 'center' },
  breakdownValue: { minWidth: 72, textAlign: 'right' },
  tabular: { fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
