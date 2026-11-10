/**
 * Acesso à API REST do Elasticsearch onde o IoTrap grava os eventos do Cowrie.
 *
 * Endpoint usado: POST <ES_URL>/<índice>/_search
 * Autenticação: cabeçalho "Authorization: ApiKey <chave>" (quando houver chave).
 */

// O Metro só substitui process.env.EXPO_PUBLIC_* quando o acesso é direto,
// por isso cada variável é lida em uma linha própria.
const ENV_BASE_URL = process.env.EXPO_PUBLIC_IOTRAP_ES_URL;
const ENV_INDEX = process.env.EXPO_PUBLIC_IOTRAP_INDEX;
const ENV_API_KEY = process.env.EXPO_PUBLIC_IOTRAP_API_KEY;

export interface IoTrapConfig {
  baseUrl: string;
  index: string;
  apiKey: string;
  timeoutMs: number;
  pageSize: number;
}

export const IOTRAP_CONFIG: IoTrapConfig = {
  baseUrl: (ENV_BASE_URL ?? 'http://localhost:9200').replace(/\/+$/, ''),
  index: ENV_INDEX ?? 'cowrie-*',
  apiKey: ENV_API_KEY ?? '',
  timeoutMs: 8000,
  pageSize: 50,
};

/**
 * Nomes de campo usados na consulta. Se o pipeline do Logstash do IoTrap usar
 * outros nomes (por exemplo, o formato ECS), basta trocar aqui.
 */
export const FIELDS = {
  timestamp: '@timestamp',
  eventId: 'eventid',
} as const;

/** Eventos do Cowrie que interessam ao analista no celular. */
export const RELEVANT_EVENT_IDS = [
  'cowrie.login.failed',
  'cowrie.login.success',
  'cowrie.command.input',
  'cowrie.command.failed',
  'cowrie.session.file_download',
] as const;

export type AttackKind =
  | 'login_failed'
  | 'login_success'
  | 'command'
  | 'download'
  | 'connect'
  | 'other';

export interface AttackEvent {
  id: string;
  kind: AttackKind;
  eventId: string;
  /** ISO 8601 */
  timestamp: string;
  srcIp: string;
  country?: string;
  city?: string;
  protocol?: string;
  dstPort?: number;
  sensor?: string;
  /** Usuário/senha tentados, comando digitado ou URL baixada. */
  detail?: string;
}

export interface RecentAttacks {
  total: number;
  events: AttackEvent[];
}

export type IoTrapErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'server'
  | 'bad_response';

export class IoTrapApiError extends Error {
  readonly kind: IoTrapErrorKind;
  readonly status?: number;

  constructor(kind: IoTrapErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'IoTrapApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Erros que não se resolvem tentando de novo: só mudando a configuração. */
export function isFatalError(error: unknown): boolean {
  return (
    error instanceof IoTrapApiError &&
    (error.kind === 'unauthorized' ||
      error.kind === 'forbidden' ||
      error.kind === 'not_found' ||
      error.kind === 'bad_response')
  );
}

export function buildSearchBody(size: number = IOTRAP_CONFIG.pageSize) {
  return {
    size,
    sort: [{ [FIELDS.timestamp]: { order: 'desc', unmapped_type: 'date' } }],
    query: {
      bool: {
        filter: [
          { range: { [FIELDS.timestamp]: { gte: 'now-24h' } } },
          { terms: { [FIELDS.eventId]: [...RELEVANT_EVENT_IDS] } },
        ],
      },
    },
  };
}

interface FetchOptions {
  signal?: AbortSignal;
  config?: IoTrapConfig;
}

/**
 * Busca os ataques mais recentes. Recebe o AbortSignal do React Query para
 * cancelar a requisição quando a consulta deixa de ser necessária, e aplica um
 * tempo limite próprio, porque o fetch do React Native não tem um.
 */
export async function fetchRecentAttacks({
  signal,
  config = IOTRAP_CONFIG,
}: FetchOptions = {}): Promise<RecentAttacks> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers.Authorization = `ApiKey ${config.apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/${encodeURIComponent(config.index)}/_search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(buildSearchBody(config.pageSize)),
        signal: controller.signal,
      },
    );
  } catch (cause) {
    if (timedOut) {
      throw new IoTrapApiError('timeout', `Sem resposta em ${config.timeoutMs / 1000} s`);
    }
    if (signal?.aborted) {
      // Cancelamento pedido pelo React Query: repassa o erro original.
      throw cause;
    }
    throw new IoTrapApiError('network', 'Sem resposta do servidor');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    throw errorFromStatus(response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new IoTrapApiError('bad_response', 'A resposta não é JSON', response.status);
  }
  return parseSearchResponse(json);
}

export function errorFromStatus(status: number): IoTrapApiError {
  if (status === 401) return new IoTrapApiError('unauthorized', 'Chave de API recusada', status);
  if (status === 403) return new IoTrapApiError('forbidden', 'Chave sem permissão de leitura', status);
  if (status === 404) return new IoTrapApiError('not_found', 'Índice não encontrado', status);
  if (status >= 500) return new IoTrapApiError('server', 'Servidor com falha', status);
  return new IoTrapApiError('bad_response', `Resposta inesperada`, status);
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Lê um caminho como "geoip.geo.country_name" sem quebrar se faltar algo. */
function pick(source: Json, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split('.')) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(source: Json, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = str(pick(source, path));
    if (value) return value;
  }
  return undefined;
}

export function kindFromEventId(eventId: string): AttackKind {
  switch (eventId) {
    case 'cowrie.login.failed':
      return 'login_failed';
    case 'cowrie.login.success':
      return 'login_success';
    case 'cowrie.command.input':
    case 'cowrie.command.failed':
      return 'command';
    case 'cowrie.session.file_download':
      return 'download';
    case 'cowrie.session.connect':
      return 'connect';
    default:
      return 'other';
  }
}

function detailFor(kind: AttackKind, source: Json): string | undefined {
  switch (kind) {
    case 'login_failed':
    case 'login_success': {
      const user = str(source.username) ?? '?';
      const pass = str(source.password) ?? '?';
      return `${user} / ${pass}`;
    }
    case 'command':
      return str(source.input);
    case 'download':
      return str(source.url);
    case 'connect': {
      const port = num(source.dst_port);
      return port ? `porta ${port}` : undefined;
    }
    default:
      return str(source.message);
  }
}

export function parseSearchResponse(json: unknown): RecentAttacks {
  if (!isObject(json) || !isObject(json.hits) || !Array.isArray(json.hits.hits)) {
    throw new IoTrapApiError('bad_response', 'Formato de resposta desconhecido');
  }
  const totalRaw = json.hits.total;
  const total = isObject(totalRaw) ? num(totalRaw.value) ?? 0 : num(totalRaw) ?? 0;

  const events: AttackEvent[] = [];
  for (const hit of json.hits.hits) {
    if (!isObject(hit) || !isObject(hit._source)) continue;
    const source = hit._source;
    const eventId = str(source.eventid) ?? str(pick(source, 'event.code')) ?? 'desconhecido';
    const timestamp = str(source['@timestamp']) ?? str(source.timestamp);
    const srcIp = str(source.src_ip) ?? str(pick(source, 'source.ip'));
    if (!timestamp || !srcIp) continue;

    const kind = kindFromEventId(eventId);
    events.push({
      id: str(hit._id) ?? `${timestamp}-${srcIp}-${events.length}`,
      kind,
      eventId,
      timestamp,
      srcIp,
      country: firstString(source, [
        'geoip.country_name',
        'geoip.geo.country_name',
        'source.geo.country_name',
      ]),
      city: firstString(source, ['geoip.city_name', 'geoip.geo.city_name', 'source.geo.city_name']),
      protocol: str(source.protocol),
      dstPort: num(source.dst_port),
      sensor: str(source.sensor),
      detail: detailFor(kind, source),
    });
  }
  return { total, events };
}

/** Título e explicação em português para mostrar na tela. */
export function describeError(
  error: unknown,
  config: Pick<IoTrapConfig, 'baseUrl' | 'index' | 'timeoutMs'> = IOTRAP_CONFIG,
): { title: string; detail: string } {
  if (!(error instanceof IoTrapApiError)) {
    return { title: 'Erro inesperado', detail: error instanceof Error ? error.message : String(error) };
  }
  const host = config.baseUrl.replace(/^https?:\/\//, '');
  switch (error.kind) {
    case 'network':
      return {
        title: 'IoTrap fora do ar',
        detail: `Sem resposta de ${host}. O celular está na mesma rede do servidor?`,
      };
    case 'timeout':
      return {
        title: 'IoTrap fora do ar',
        detail: `${host} não respondeu em ${config.timeoutMs / 1000} s.`,
      };
    case 'server':
      return {
        title: 'IoTrap fora do ar',
        detail: `O servidor respondeu ${error.status}.`,
      };
    case 'unauthorized':
      return {
        title: 'Chave de API recusada (401)',
        detail: 'Confira EXPO_PUBLIC_IOTRAP_API_KEY no .env.local e reinicie com npx expo start -c.',
      };
    case 'forbidden':
      return {
        title: 'Chave sem permissão (403)',
        detail: `A chave não tem permissão de leitura no índice ${config.index}.`,
      };
    case 'not_found':
      return {
        title: 'Índice não encontrado (404)',
        detail: `Não existe índice ${config.index} em ${host}.`,
      };
    case 'bad_response':
      return {
        title: 'Resposta inesperada',
        detail: `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}.`,
      };
  }
}
