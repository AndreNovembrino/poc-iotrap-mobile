import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { formatRelative } from '../lib/format';
import { colors } from './theme';

export type FeedStatus = 'live' | 'paused' | 'down';

interface Props {
  status: FeedStatus;
  shown: number;
  total: number;
  updatedAt: number;
  now: number;
  isFetching: boolean;
}

const statusStyle: Record<FeedStatus, { label: string; color: string }> = {
  live: { label: 'Ao vivo', color: colors.live },
  paused: { label: 'Pausado', color: colors.paused },
  down: { label: 'Fora do ar', color: colors.danger },
};

export function FeedHeader({ status, shown, total, updatedAt, now, isFetching }: Props) {
  const { label, color } = statusStyle[status];
  const updatedText = updatedAt > 0 ? `Atualizado ${formatRelative(updatedAt, now)}` : 'Ainda sem dados';

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>IoTrap</Text>
        <View style={[styles.pill, { borderColor: color }]} accessibilityLabel={`Status: ${label}`}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.pillText, { color }]}>{label}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Ataques nas últimas 24 h · {shown}
        {total > shown ? ` de ${total}` : ''}
      </Text>
      <View style={styles.updatedRow}>
        <Text style={styles.updated}>{updatedText}</Text>
        {isFetching && <ActivityIndicator size="small" color={colors.textMuted} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  subtitle: { fontSize: 14, color: colors.textMuted },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  updated: { fontSize: 13, color: colors.text },
});
