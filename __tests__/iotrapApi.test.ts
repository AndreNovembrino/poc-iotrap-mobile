import {
  buildSearchBody,
  describeError,
  errorFromStatus,
  IoTrapApiError,
  isFatalError,
  parseSearchResponse,
} from '../lib/iotrapApi';
import { formatRelative } from '../lib/format';

describe('parseSearchResponse', () => {
  it('converte hits do Cowrie (campos clássicos e geoip do Logstash)', () => {
    const result = parseSearchResponse({
      hits: {
        total: { value: 2, relation: 'eq' },
        hits: [
          {
            _id: 'a',
            _source: {
              '@timestamp': '2026-11-10T18:00:00.000Z',
              eventid: 'cowrie.command.input',
              src_ip: '203.0.113.45',
              input: 'uname -a',
              protocol: 'telnet',
              dst_port: 23,
              geoip: { country_name: 'China', city_name: 'Shenzhen' },
            },
          },
          {
            _id: 'b',
            _source: {
              timestamp: '2026-11-10T17:59:00.000Z',
              eventid: 'cowrie.login.failed',
              src_ip: '192.0.2.14',
              username: 'pi',
              password: 'raspberry',
            },
          },
        ],
      },
    });

    expect(result.total).toBe(2);
    expect(result.events[0]).toMatchObject({
      id: 'a',
      kind: 'command',
      detail: 'uname -a',
      country: 'China',
      city: 'Shenzhen',
      dstPort: 23,
    });
    expect(result.events[1]).toMatchObject({ id: 'b', kind: 'login_failed', detail: 'pi / raspberry' });
    expect(result.events[1].country).toBeUndefined();
  });

  it('aceita nomes no formato ECS (event.code, source.ip, source.geo)', () => {
    const result = parseSearchResponse({
      hits: {
        total: 1,
        hits: [
          {
            _id: 'x',
            _source: {
              '@timestamp': '2026-11-10T18:00:00.000Z',
              event: { code: 'cowrie.session.file_download' },
              source: { ip: '198.51.100.23', geo: { country_name: 'Brasil' } },
              url: 'http://198.51.100.23/bins.sh',
            },
          },
        ],
      },
    });
    expect(result.total).toBe(1);
    expect(result.events[0]).toMatchObject({
      kind: 'download',
      srcIp: '198.51.100.23',
      country: 'Brasil',
      detail: 'http://198.51.100.23/bins.sh',
    });
  });

  it('ignora documentos sem data ou sem IP em vez de quebrar a tela', () => {
    const result = parseSearchResponse({
      hits: { total: { value: 3 }, hits: [{ _source: {} }, { nada: 1 }, null] },
    });
    expect(result.events).toEqual([]);
  });

  it('recusa respostas que não parecem do Elasticsearch', () => {
    expect(() => parseSearchResponse({ ok: true })).toThrow(IoTrapApiError);
    expect(() => parseSearchResponse('html')).toThrow(IoTrapApiError);
  });
});

describe('erros', () => {
  it('classifica status HTTP', () => {
    expect(errorFromStatus(401).kind).toBe('unauthorized');
    expect(errorFromStatus(403).kind).toBe('forbidden');
    expect(errorFromStatus(404).kind).toBe('not_found');
    expect(errorFromStatus(503).kind).toBe('server');
    expect(errorFromStatus(400).kind).toBe('bad_response');
  });

  it('só trata como fatal o que tentar de novo não resolve', () => {
    expect(isFatalError(errorFromStatus(401))).toBe(true);
    expect(isFatalError(errorFromStatus(404))).toBe(true);
    expect(isFatalError(errorFromStatus(503))).toBe(false);
    expect(isFatalError(new IoTrapApiError('network', 'x'))).toBe(false);
    expect(isFatalError(new IoTrapApiError('timeout', 'x'))).toBe(false);
    expect(isFatalError(new Error('x'))).toBe(false);
  });

  it('gera mensagens em português com o motivo', () => {
    const config = { baseUrl: 'http://10.0.0.5:9200', index: 'cowrie-*', timeoutMs: 8000 };
    expect(describeError(errorFromStatus(401), config).title).toBe('Chave de API recusada (401)');
    expect(describeError(errorFromStatus(503), config)).toEqual({
      title: 'IoTrap fora do ar',
      detail: 'O servidor respondeu 503.',
    });
    expect(describeError(new IoTrapApiError('network', 'x'), config).detail).toContain('10.0.0.5:9200');
  });
});

describe('consulta', () => {
  it('pede os eventos mais novos primeiro, das últimas 24 h', () => {
    const body = buildSearchBody(20);
    expect(body.size).toBe(20);
    expect(body.sort[0]['@timestamp'].order).toBe('desc');
    expect(body.query.bool.filter[0]).toEqual({ range: { '@timestamp': { gte: 'now-24h' } } });
  });
});

describe('formatRelative', () => {
  it('formata intervalos curtos e longos', () => {
    const now = 1_000_000_000;
    expect(formatRelative(now - 2_000, now)).toBe('agora');
    expect(formatRelative(now - 12_000, now)).toBe('há 12 s');
    expect(formatRelative(now - 3 * 60_000, now)).toBe('há 3 min');
    expect(formatRelative(now - 2 * 3_600_000, now)).toBe('há 2 h');
  });
});
