import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttackCard } from './components/AttackCard';
import { CenteredState } from './components/CenteredState';
import { FeedHeader, type FeedStatus } from './components/FeedHeader';
import { StatusBanner } from './components/StatusBanner';
import { colors } from './components/theme';
import { useIsOnline } from './hooks/useIsOnline';
import { useNow } from './hooks/useNow';
import { useRecentAttacks } from './hooks/useRecentAttacks';
import { formatClock } from './lib/format';
import { describeError, IOTRAP_CONFIG, type AttackEvent } from './lib/iotrapApi';
import { queryClient, REFRESH_INTERVAL_MS } from './lib/queryClient';
import { setupOnlineManager, useAppStateFocus } from './lib/reactNativeManagers';

setupOnlineManager();

export default function App() {
  useAppStateFocus();

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AttackFeedScreen />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function attemptsText(count: number): string {
  return count > 0 ? ` Falhou após ${count} ${count === 1 ? 'tentativa' : 'tentativas'}.` : '';
}

const keyExtractor = (item: AttackEvent) => item.id;

function AttackFeedScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const isOnline = useIsOnline();
  const { data, error, isPending, isError, isFetching, fetchStatus, dataUpdatedAt, failureCount, refetch } =
    useRecentAttacks();
  // Estado próprio só para o gesto de puxar: as atualizações automáticas não
  // devem mostrar o indicador do RefreshControl.
  const [pulling, setPulling] = useState(false);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onPull = useCallback(async () => {
    // Sem rede a busca fica pausada até reconectar; não prende o indicador.
    if (!onlineManager.isOnline()) return;
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: AttackEvent }) => <AttackCard event={item} now={now} />,
    [now],
  );

  const status: FeedStatus = !isOnline ? 'paused' : isError ? 'down' : 'live';
  const source = `${IOTRAP_CONFIG.baseUrl.replace(/^https?:\/\//, '')}/${IOTRAP_CONFIG.index}`;

  let body: ReactNode;
  if (!data) {
    if (isPending && fetchStatus === 'paused') {
      body = <CenteredState title="Sem conexão" detail="A lista aparece assim que a rede voltar." />;
    } else if (isPending) {
      body = <CenteredState loading title="Buscando ataques no IoTrap…" detail={source} />;
    } else {
      const { title, detail } = describeError(error);
      body = (
        <CenteredState
          tone="error"
          title={title}
          detail={`${detail}${attemptsText(failureCount)}`}
          actionLabel="Tentar de novo"
          onAction={retry}
        />
      );
    }
  } else {
    const problem = isError ? describeError(error) : null;
    body = (
      <FlatList
        data={data.events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={now}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          !isOnline ? (
            <StatusBanner
              tone="offline"
              title={`Sem conexão — mostrando dados de ${formatClock(dataUpdatedAt)}`}
              detail="A lista volta a atualizar sozinha quando a rede voltar."
            />
          ) : problem ? (
            <StatusBanner
              tone="error"
              title={problem.title}
              detail={`${problem.detail}${attemptsText(failureCount)} Mostrando dados de ${formatClock(dataUpdatedAt)}.`}
              actionLabel={isFetching ? 'Tentando…' : 'Tentar de novo'}
              onAction={retry}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <CenteredState
            title="Nenhum ataque nas últimas 24 h"
            detail="Bom sinal, ou o honeypot está desligado."
          />
        }
        ListFooterComponent={
          <Text style={styles.footer}>
            Fonte: {source} · atualiza a cada {REFRESH_INTERVAL_MS / 1000} s
          </Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onPull}
            tintColor={colors.textMuted}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <FeedHeader
        status={status}
        shown={data?.events.length ?? 0}
        total={data?.total ?? 0}
        updatedAt={dataUpdatedAt}
        now={now}
        isFetching={isFetching && !pulling && !isPending}
      />
      {body}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  separator: { height: 8 },
  footer: { marginTop: 16, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
