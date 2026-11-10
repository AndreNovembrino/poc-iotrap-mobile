import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

interface Props {
  tone: 'offline' | 'error';
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StatusBanner({ tone, title, detail, actionLabel, onAction }: Props) {
  const isError = tone === 'error';
  return (
    <View
      style={[styles.container, isError ? styles.error : styles.offline]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.texts}>
        <Text style={[styles.title, isError && { color: colors.danger }]}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  error: { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
  offline: { backgroundColor: colors.offlineSurface, borderColor: colors.border },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
  },
  buttonText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
