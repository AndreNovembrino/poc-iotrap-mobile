import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

interface Props {
  title: string;
  detail?: string;
  loading?: boolean;
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

/** Tela inteira para quando ainda não há lista: carregando, erro ou sem rede. */
export function CenteredState({ title, detail, loading, tone = 'neutral', actionLabel, onAction }: Props) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {loading && <ActivityIndicator size="large" color={colors.accent} />}
      <Text style={[styles.title, tone === 'error' && { color: colors.danger }]}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  detail: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: colors.text },
});
