import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRelative } from '../lib/format';
import type { AttackEvent } from '../lib/iotrapApi';
import { colors, kindStyle, mono } from './theme';

interface Props {
  event: AttackEvent;
  now: number;
}

const NEW_WINDOW_MS = 30_000;

function AttackCardComponent({ event, now }: Props) {
  const { label, color } = kindStyle[event.kind];
  const happenedAt = Date.parse(event.timestamp);
  const isNew = now - happenedAt < NEW_WINDOW_MS;
  const place = [event.city, event.country].filter(Boolean).join(', ') || 'local desconhecido';
  const meta = [event.protocol?.toUpperCase(), event.dstPort ? `porta ${event.dstPort}` : undefined, event.sensor]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${label} de ${event.srcIp}, ${place}, ${formatRelative(happenedAt, now)}`}
    >
      <View style={[styles.stripe, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.kind, { color }]}>{label}</Text>
          {isNew && <Text style={styles.newBadge}>NOVO</Text>}
          <Text style={styles.time}>{formatRelative(happenedAt, now)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.ip}>{event.srcIp}</Text>
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        </View>
        {event.detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {event.detail}
          </Text>
        ) : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

export const AttackCard = memo(AttackCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stripe: { width: 4 },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  newBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.background,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  time: { marginLeft: 'auto', fontSize: 12, color: colors.textMuted },
  ip: { fontFamily: mono, fontSize: 15, color: colors.text, fontWeight: '600' },
  place: { flex: 1, fontSize: 13, color: colors.textMuted },
  detail: {
    fontFamily: mono,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  meta: { fontSize: 11, color: colors.textMuted },
});
