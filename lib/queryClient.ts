import { QueryClient } from '@tanstack/react-query';

import { isFatalError } from './iotrapApi';

/** Intervalo da atualização automática enquanto o app está em primeiro plano. */
export const REFRESH_INTERVAL_MS = 10_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Depois de 5 s os dados contam como velhos: voltar ao app ou reconectar
      // dispara uma nova busca.
      staleTime: 5_000,
      // Erros de configuração (401, 403, 404) não melhoram tentando de novo.
      retry: (failureCount, error) => !isFatalError(error) && failureCount < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    },
  },
});
