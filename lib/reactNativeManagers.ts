/**
 * No navegador o React Query descobre sozinho quando a aba ganha foco e quando a
 * rede volta. No React Native não existe window, então é preciso ligar:
 *  - onlineManager ao estado da rede (expo-network);
 *  - focusManager ao AppState (app em primeiro plano ou não).
 *
 * Fonte: https://tanstack.com/query/latest/docs/framework/react/react-native
 */
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

let onlineManagerReady = false;

export function setupOnlineManager(): void {
  if (onlineManagerReady) return;
  onlineManagerReady = true;

  onlineManager.setEventListener((setOnline) => {
    let initialised = false;

    const subscription = Network.addNetworkStateListener((state) => {
      initialised = true;
      setOnline(!!state.isConnected);
    });

    // O listener só dispara quando a rede muda; o estado inicial vem daqui.
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialised) setOnline(!!state.isConnected);
      })
      .catch(() => {
        // Em algumas plataformas a leitura inicial pode falhar; o listener cobre.
      });

    return () => subscription.remove();
  });
}

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

/** Faz o React Query tratar "app em primeiro plano" como "janela com foco". */
export function useAppStateFocus(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);
}
