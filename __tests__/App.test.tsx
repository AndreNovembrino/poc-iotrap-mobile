/**
 * Simula os critérios do CRITERIOS.md sem aparelho: troca o fetch por um
 * "Elasticsearch de mentira", controla a rede (expo-network) e o AppState, e
 * avança o relógio com timers falsos. Não substitui a verificação no celular.
 */
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

type NetworkListener = (state: { isConnected: boolean }) => void;
jest.mock('expo-network', () => {
  const listeners: Array<(state: { isConnected: boolean }) => void> = [];
  return {
    __listeners: listeners,
    addNetworkStateListener: (listener: (state: { isConnected: boolean }) => void) => {
      listeners.push(listener);
      return { remove: () => undefined };
    },
    getNetworkStateAsync: () => Promise.resolve({ isConnected: true }),
  };
});
const mockNetworkListeners: NetworkListener[] = jest.requireMock('expo-network').__listeners;

const appStateHandlers: Array<(status: AppStateStatus) => void> = [];
jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
  appStateHandlers.push(handler as (status: AppStateStatus) => void);
  return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
});

// Carregado depois dos mocks acima (import seria içado para o topo).
const App: typeof import('../App').default = require('../App').default;
const { queryClient }: typeof import('../lib/queryClient') = require('../lib/queryClient');

type Mode = 'up' | 'down' | 'unauthorized';
const server: { mode: Mode; hits: object[] } = { mode: 'up', hits: [] };

function hit(id: string, secondsAgo: number, ip: string, eventid = 'cowrie.login.failed') {
  return {
    _id: id,
    _source: {
      '@timestamp': new Date(Date.now() - secondsAgo * 1000).toISOString(),
      eventid,
      src_ip: ip,
      username: 'root',
      password: 'root',
      geoip: { country_name: 'China' },
    },
  };
}

const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => {
  if (server.mode === 'down') return { ok: false, status: 503, json: async () => ({}) };
  if (server.mode === 'unauthorized') return { ok: false, status: 401, json: async () => ({}) };
  const hits = [...server.hits].sort(
    (a: any, b: any) => Date.parse(b._source['@timestamp']) - Date.parse(a._source['@timestamp']),
  );
  return { ok: true, status: 200, json: async () => ({ hits: { total: { value: hits.length }, hits } }) };
});

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

const setOnline = (isConnected: boolean) =>
  act(async () => {
    mockNetworkListeners.forEach((listener) => listener({ isConnected }));
    await jest.advanceTimersByTimeAsync(0);
  });

const setAppState = (status: AppStateStatus) =>
  act(async () => {
    appStateHandlers.forEach((handler) => handler(status));
    await jest.advanceTimersByTimeAsync(0);
  });

async function renderLoaded() {
  await render(<App />);
  await advance(0);
  expect(screen.getByText('203.0.113.1')).toBeOnTheScreen();
}

beforeEach(() => {
  jest.useFakeTimers();
  (globalThis as any).fetch = fetchMock;
  fetchMock.mockClear();
  server.mode = 'up';
  server.hits = [hit('old', 120, '203.0.113.1'), hit('older', 600, '203.0.113.2', 'cowrie.command.input')];
});

afterEach(async () => {
  await setOnline(true);
  focusManager.setFocused(undefined);
  queryClient.clear();
  jest.useRealTimers();
});

test('C1: mostra a lista do mais recente para o mais antigo, com tipo, IP, país e tempo', async () => {
  await renderLoaded();
  const ips = screen.getAllByText(/^203\.0\.113\.\d$/).map((node) => node.props.children);
  expect(ips).toEqual(['203.0.113.1', '203.0.113.2']);
  expect(screen.getByText('Login falhou')).toBeOnTheScreen();
  expect(screen.getByText('Comando executado')).toBeOnTheScreen();
  expect(screen.getAllByText('China')).toHaveLength(2);
  expect(screen.getByText('há 2 min')).toBeOnTheScreen();
  expect(screen.getByText('Ao vivo')).toBeOnTheScreen();
});

test('C2: um ataque novo aparece no topo sem tocar na tela', async () => {
  await renderLoaded();
  server.hits = [...server.hits, hit('new', 0, '203.0.113.9')];
  await advance(10_000);
  const ips = screen.getAllByText(/^203\.0\.113\.\d$/).map((node) => node.props.children);
  expect(ips[0]).toBe('203.0.113.9');
  expect(screen.getByText('NOVO')).toBeOnTheScreen();
  expect(screen.getByText('Atualizado agora')).toBeOnTheScreen();
});

test('C3: com a API fora do ar, a lista antiga fica e aparece o aviso; volta com "Tentar de novo"', async () => {
  await renderLoaded();
  server.mode = 'down';
  // 10 s até a próxima busca + 2 novas tentativas (1 s e 2 s de espera).
  await advance(10_000 + 1_000 + 2_000 + 100);
  expect(screen.getByText('IoTrap fora do ar')).toBeOnTheScreen();
  expect(screen.getByText(/Falhou após 3 tentativas/)).toBeOnTheScreen();
  expect(screen.getByText('203.0.113.1')).toBeOnTheScreen();
  expect(screen.getByText('Fora do ar')).toBeOnTheScreen();

  server.mode = 'up';
  await fireEvent.press(screen.getByText('Tentar de novo'));
  await advance(0);
  expect(screen.queryByText('IoTrap fora do ar')).not.toBeOnTheScreen();
  expect(screen.getByText('Ao vivo')).toBeOnTheScreen();
});

test('C3: abrindo o app com a API já fora do ar, mostra a tela de erro sem travar', async () => {
  server.mode = 'down';
  await render(<App />);
  await advance(1_000 + 2_000 + 100);
  expect(screen.getByText('IoTrap fora do ar')).toBeOnTheScreen();
  expect(screen.getByText('Tentar de novo')).toBeOnTheScreen();
});

test('C4: chave errada mostra 401 e não fica tentando', async () => {
  server.mode = 'unauthorized';
  await render(<App />);
  await advance(100);
  expect(screen.getByText('Chave de API recusada (401)')).toBeOnTheScreen();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await advance(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('C5: sem rede mostra a faixa, pausa as buscas e atualiza sozinho ao voltar', async () => {
  await renderLoaded();
  const callsBefore = fetchMock.mock.calls.length;
  await setOnline(false);
  expect(screen.getByText(/^Sem conexão — mostrando dados de \d\d:\d\d:\d\d$/)).toBeOnTheScreen();
  expect(screen.getByText('Pausado')).toBeOnTheScreen();
  await advance(30_000);
  expect(fetchMock.mock.calls.length).toBe(callsBefore);
  expect(screen.getByText('203.0.113.1')).toBeOnTheScreen();

  server.hits = [...server.hits, hit('while-offline', 0, '203.0.113.7')];
  await setOnline(true);
  await advance(0);
  expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
  expect(screen.queryByText(/^Sem conexão/)).not.toBeOnTheScreen();
  expect(screen.getByText('203.0.113.7')).toBeOnTheScreen();
});

test('C6: em segundo plano não busca; ao voltar, atualiza na hora', async () => {
  await renderLoaded();
  const callsBefore = fetchMock.mock.calls.length;
  await setAppState('background');
  await advance(30_000);
  expect(fetchMock.mock.calls.length).toBe(callsBefore);

  await setAppState('active');
  await advance(0);
  expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
});
