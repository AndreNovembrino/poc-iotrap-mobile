# Critérios de aceitação

Escritos antes da implementação. Cada um é conferido no aplicativo rodando, com o
servidor `mock-server` (ou o Elasticsearch do IoTrap) no ar, e marcado só depois de
visto na tela.

- [ ] **C1. Lista de ataques.** Ao abrir o app, a tela mostra os ataques das últimas
      24 h, do mais recente para o mais antigo. Cada item tem o tipo do evento
      (ex.: "Login falhou"), o IP de origem, o país e há quanto tempo aconteceu.
- [ ] **C2. Atualização sozinha.** Sem tocar na tela, um ataque novo registrado no
      honeypot aparece no topo da lista em até 20 s, e o cabeçalho volta a dizer
      "Atualizado agora".
- [ ] **C3. API fora do ar (erro).** Com a lista já carregada, derrubo a API
      (`http://<ip>:9200/__mock/down`). Em até 20 s aparece o aviso vermelho
      "IoTrap fora do ar", a lista antiga continua na tela e o botão
      "Tentar de novo" funciona assim que a API volta (`/__mock/up`). Se o app for
      aberto com a API já fora do ar, aparece a tela de erro com o motivo, sem travar.
- [ ] **C4. Chave de API errada (entrada inválida).** Com
      `EXPO_PUBLIC_IOTRAP_API_KEY` errada, o app mostra "Chave de API recusada (401)"
      em menos de 3 s, sem ficar tentando de novo em loop.
- [ ] **C5. Sem internet.** Com o modo avião ligado, aparece a faixa
      "Sem conexão — mostrando dados de HH:MM:SS" e a lista continua na tela. Ao
      desligar o modo avião, a lista se atualiza sozinha, sem tocar na tela.
- [ ] **C6. Volta do segundo plano.** Deixo o app em segundo plano por mais de 15 s
      e, ao voltar, a lista se atualiza assim que a tela aparece.

**Verificado em:** ( ) aparelho físico ( ) emulador
**Resultado:** ( ) passou ( ) reprovou

## Como reproduzir cada critério

| Critério | Como provocar | O que olhar |
|----------|---------------|-------------|
| C1 | `npm run mock` e abrir o app | lista ordenada, tipo, IP, país, "há X min" |
| C2 | esperar; o mock cria um ataque a cada ~12 s | item novo no topo, "Atualizado agora" |
| C3 | abrir `http://<ip>:9200/__mock/down` no navegador | faixa vermelha, lista antiga visível |
| C4 | trocar a chave no `.env.local` e reiniciar com `npx expo start -c` | mensagem de 401, contador de tentativas não sobe |
| C5 | modo avião no celular | faixa cinza; ao desligar, atualiza sozinho |
| C6 | botão de início, esperar 15 s, voltar ao app | "Atualizado agora" logo ao voltar |

Observação para o C5: no Expo Go, ligar o modo avião também corta a conexão com o
Metro. O app continua rodando com o código já carregado, mas o Expo Go pode mostrar
um aviso de desconexão. Se ele recarregar o app ao reconectar, registre isso no
PESQUISA.md e use o vídeo de segurança na apresentação.
