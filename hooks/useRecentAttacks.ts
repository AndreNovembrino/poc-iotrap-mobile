import { useQuery } from '@tanstack/react-query';

import { fetchRecentAttacks, IOTRAP_CONFIG, isFatalError } from '../lib/iotrapApi';
import { REFRESH_INTERVAL_MS } from '../lib/queryClient';

export function useRecentAttacks() {
  return useQuery({
    queryKey: ['iotrap', 'recent-attacks', IOTRAP_CONFIG.baseUrl, IOTRAP_CONFIG.index],
    queryFn: ({ signal }) => fetchRecentAttacks({ signal }),
    // Atualiza sozinho, exceto quando o erro é de configuração (401, 404...):
    // nesse caso só o botão "Tentar de novo" volta a buscar.
    refetchInterval: (query) => (isFatalError(query.state.error) ? false : REFRESH_INTERVAL_MS),
  });
}
