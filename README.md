# IoTrap Mobile (prova de conceito)

Pesquisa aplicada com IA da disciplina **Desenvolvimento de Aplicativos Híbridos**
(Prof. Rodrigo Bossini), ligada ao TCC **IoTrap**, um honeypot para dispositivos IoT.

> **Pergunta:** como o `@tanstack/react-query` permite que um app Expo mostre, quase em
> tempo real, os ataques que o IoTrap grava no Elasticsearch, mantendo a última lista na
> tela e avisando o motivo quando o celular fica sem rede ou a API do IoTrap sai do ar?

- Diário de pesquisa: [PESQUISA.md](PESQUISA.md)
- Critérios de aceitação: [CRITERIOS.md](CRITERIOS.md)
- Roteiro da apresentação: [APRESENTACAO.md](APRESENTACAO.md)

Trilha: **Consumo de API** (`fetch`, `@tanstack/react-query`). Roda no **Expo Go**
(Expo SDK 58), sem development build.

## Como rodar

Precisa de Node 20+ e do Expo Go no celular, com o celular e o computador na mesma Wi-Fi.

```bash
npm install

# Terminal 1: servidor que imita o Elasticsearch do IoTrap
npm run mock
# ele mostra a linha certa, por exemplo:
#   no .env.local: EXPO_PUBLIC_IOTRAP_ES_URL=http://192.168.0.15:9200

# Copie o exemplo e cole a linha que o mock mostrou
cp .env.example .env.local

# Terminal 2: app
npx expo start
```

Leia o QR Code com a câmera (iOS) ou pelo Expo Go (Android). Se a rede bloquear, use
`npx expo start --tunnel`; nesse caso o celular continua precisando alcançar o IP do
mock na rede local.

Sempre que mudar o `.env.local`, reinicie com `npx expo start -c`.

### Controlar o mock durante a demonstração

Abra no navegador do computador ou do celular:

| Endereço | Efeito | Critério |
|----------|--------|----------|
| `http://<ip>:9200/__mock/attack` | registra um ataque agora | C2 |
| `http://<ip>:9200/__mock/down` | passa a responder 503 | C3 |
| `http://<ip>:9200/__mock/slow` | demora 12 s (estoura o tempo limite de 8 s) | C3 |
| `http://<ip>:9200/__mock/up` | volta ao normal | C3 |
| `http://<ip>:9200/__mock/status` | mostra o modo atual | |

Para testar a chave errada (C4), rode `MOCK_API_KEY=segredo npm run mock` e deixe
`EXPO_PUBLIC_IOTRAP_API_KEY` diferente de `segredo` no `.env.local`.

O mock cria um ataque novo a cada ~12 s. Os IPs são de faixas reservadas para
documentação (RFC 5737), não de pessoas reais.

### Usar o Elasticsearch de verdade do IoTrap

1. Crie uma chave **somente leitura**, restrita ao índice do Cowrie, no Dev Tools do Kibana:

   ```
   POST /_security/api_key
   {
     "name": "iotrap-mobile-poc",
     "expiration": "30d",
     "role_descriptors": {
       "leitura-cowrie": {
         "indices": [{ "names": ["cowrie-*"], "privileges": ["read"] }]
       }
     }
   }
   ```

2. No `.env.local`, use o endereço do Elasticsearch, o nome do índice e o campo
   `encoded` da resposta em `EXPO_PUBLIC_IOTRAP_API_KEY`.
3. Se o pipeline do Logstash usar outros nomes de campo (por exemplo, o formato ECS),
   ajuste `FIELDS` em `lib/iotrapApi.ts`.

> **Segurança.** Tudo que começa com `EXPO_PUBLIC_` vai embutido no aplicativo, então
> a chave não é segredo. Por isso ela é somente leitura e expira. Em produção, o app
> deve falar com uma API de leitura do IoTrap, e não direto com o Elasticsearch.

### Se não conectar

- **"IoTrap fora do ar · Sem resposta de ..."**: o celular não alcança o IP do mock.
  Confira se estão na mesma Wi-Fi, se o IP do `.env.local` é o que o mock mostrou e se o
  firewall do computador libera a porta 9200 (abra `http://<ip>:9200` no navegador do
  celular: deve aparecer um JSON).
- **iPhone**: o Expo Go precisa da permissão de Rede Local (Ajustes > Expo Go).
- **Mudou o `.env.local` e nada mudou**: reinicie com `npx expo start -c`.

## Testes

```bash
npm run typecheck   # TypeScript
npm test            # 16 testes (jest-expo + Testing Library)
```

`__tests__/App.test.tsx` simula os critérios C1 a C6 com um servidor falso, rede e
AppState controlados e relógio falso. Os testes não substituem a verificação no
aparelho: o CRITERIOS.md só é marcado depois de visto na tela.

## Estrutura

```
App.tsx                      tela única: lista, faixas de aviso, puxar para atualizar
components/                  AttackCard, FeedHeader, StatusBanner, CenteredState, theme
hooks/useRecentAttacks.ts    useQuery com refetchInterval que para em erro de configuração
hooks/useIsOnline.ts         lê o onlineManager do React Query
hooks/useNow.ts              relógio para os textos "há X s"
lib/iotrapApi.ts             POST /<índice>/_search, conversão dos eventos do Cowrie, erros
lib/queryClient.ts           staleTime, retry e retryDelay
lib/reactNativeManagers.ts   expo-network -> onlineManager, AppState -> focusManager
mock-server/server.mjs       imitação do Elasticsearch do IoTrap, sem dependências
AGENTS.md                    contexto e regras para o agente (Copilot)
.vscode/mcp.json             servidor MCP da Expo
.github/copilot-instructions.md
```
