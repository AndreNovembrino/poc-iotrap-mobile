# Roteiro da apresentação (10 min + 2 de perguntas)

Segue a Tabela 3 da apostila. Tempo acumulado entre parênteses.

## 1. O TCC e o problema (1 min, até 1:00)

- "O IoTrap é um honeypot para IoT: finge ser um dispositivo vulnerável, registra quem
  ataca e o que tenta fazer, e mostra tudo no Kibana."
- "O problema: o Kibana só serve no computador. Quem cuida da segurança de uma PME
  não fica olhando o Kibana o dia inteiro, e no celular a rede cai."

## 2. Pergunta e escolha (1,5 min, até 2:30)

- Ler a pergunta de pesquisa do PESQUISA.md.
- Tabela de alternativas: `fetch` + `useEffect`, hook `useFetch`, React Query, Kibana no
  celular; NetInfo × expo-network. Todas rodam no Expo Go.
- "Escolhi o React Query porque cada coisa que eu precisava (atualizar sozinho, tentar
  de novo, manter os dados antigos, pausar sem rede) é uma opção da biblioteca, e não
  estado que eu controlo na mão."

## 3. Como funciona (2 min, até 4:30)

Só o diagrama, sem código:

1. Cowrie grava no Elasticsearch; o app faz `POST /cowrie-*/_search` a cada 10 s.
2. O resultado vai para o cache do React Query; a tela lê do cache.
3. Se a busca falha, o cache continua e a tela mostra o motivo.
4. No celular não há `window`: `expo-network` diz ao React Query se há rede
   (`onlineManager`) e o `AppState` diz se o app está aberto (`focusManager`).
5. Erro de configuração (401, 404) não tenta de novo e para a atualização automática.

## 4. Demonstração (3 min, até 7:30)

Antes de começar: mock rodando, app aberto, navegador do computador com as rotas de
controle em abas.

| Tempo | Critério | Ação | O que mostrar |
|-------|----------|------|---------------|
| 0:00 | C1 | app aberto | lista, tipos coloridos, IP, país, "há X min" |
| 0:30 | C2 | esperar ou abrir `/__mock/attack` | item NOVO no topo, "Atualizado agora" |
| 1:00 | C3 | abrir `/__mock/down` | faixa vermelha, lista antiga continua; `/__mock/up` + "Tentar de novo" |
| 1:45 | C5 | modo avião | faixa "Sem conexão", status "Pausado"; desligar e ver atualizar sozinho |
| 2:30 | C6 | botão de início, voltar | "Atualizado agora" na volta |
| 2:50 | C4 | (no vídeo, para não reiniciar ao vivo) | "Chave de API recusada (401)" |

Se a demonstração ao vivo falhar, passar o vídeo de segurança.

## 5. Onde a IA errou (1,5 min, até 9:00)

Pelo menos um erro, com pedido, resposta, como percebi e o certo (seção do
PESQUISA.md). Sugestão de ordem:

1. MCP da Expo: a IA disse que era pago lendo uma página desatualizada; o changelog
   oficial de 26/05/2026 diz que tem plano Free com cota. Lição: a doc também envelhece.
2. O erro encontrado com o Copilot no modo Agent.
3. `null` em `ListHeaderComponent`, pego pelo `tsc`.

## 6. Próximos passos (1 min, até 10:00)

- No TCC, o app fala com uma API de leitura do IoTrap, não direto com o Elasticsearch:
  `EXPO_PUBLIC_` fica embutido no app.
- Notificação de eventos graves (login aceito, download de malware).
- Cache salvo entre aberturas do app; eventos do Dionaea; mostrar IPs já bloqueados.

## Perguntas prováveis

- **Por que não WebSocket?** O Elasticsearch não empurra eventos; polling de 10 s com
  o app aberto basta para a PoC e para de rodar em segundo plano.
- **A chave no app não é um risco?** É, por isso é somente leitura, restrita ao índice e
  com validade. No TCC fica atrás de uma API.
- **Como sabe que funcionou?** Critérios escritos antes, verificados no aparelho e
  cobertos por testes que falham se eu tirar o `onlineManager` ou o `focusManager`.

---

## Prompt para a ferramenta de slides (seção 6.2 da apostila)

> Crie uma apresentação de 8 slides, em português, a partir do diário de pesquisa abaixo.
> Siga esta ordem: contexto do TCC e problema; pergunta de pesquisa; alternativas
> consideradas, em tabela; como a tecnologia funciona, em diagrama; demonstração (deixe um
> slide só com o título); onde a IA errou; próximos passos; fontes. Use frases curtas e
> nenhum bloco de código.
>
> [cole aqui o conteúdo do PESQUISA.md]

Depois de gerar: revisar slide por slide e apagar tudo que não veio do diário.
