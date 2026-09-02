# Aplicativo desktop para YouTube Live Gamer 3D

## Objetivo

Entregar um executável Windows que apresente a interface Three.js em uma janela
desktop própria. O usuário não deve precisar iniciar um navegador nem manter uma
janela de terminal aberta.

## Arquitetura

- O FastAPI continua sendo o único backend da aplicação, incluindo WebSocket,
  API de streaming, arquivos estáticos e modelos GLB.
- Um módulo `app.desktop` inicia esse backend em uma thread local, em uma porta
  de loopback livre escolhida automaticamente. Assim o aplicativo não conflita
  com uma instância local existente na porta 8000.
- Depois de o endpoint `/api/status` responder, o módulo cria uma janela nativa
  pelo PyWebView apontando para a URL local. O WebView do Windows renderiza a
  mesma interface Three.js que hoje é atendida pelo navegador.
- O fechamento da janela solicita o desligamento do servidor interno e encerra
  o processo sem deixar uma porta ou processo filho em execução.

## Janela e experiência

- Título: `YouTube Live Gamer 3D`.
- Janela inicial de 1280 x 820 pixels, redimensionável e com tamanho mínimo
  suficiente para a interface de transmissão.
- A distribuição usa o modo sem console: não exibe o terminal de logs visto no
  executável anterior.
- O aplicativo utiliza exclusivamente `127.0.0.1`; não cria serviço de rede
  acessível por outros dispositivos.

## Ícone

- Ícone original em estilo gamer 3D: fundo verde-escuro, cenário de gramado
  low-poly e símbolo claro de transmissão/play.
- O ativo principal será fornecido em PNG e convertido para ICO com os tamanhos
  necessários ao Windows. O ICO será aplicado ao executável e o PNG poderá ser
  usado como favicon da página.

## Empacotamento

- Adicionar PyWebView às dependências do aplicativo desktop.
- PyInstaller no modo `--noconsole`, incluindo frontend estático, modelos GLB,
  FFmpeg e o arquivo ICO.
- O EXE final permanece em `output/LiveGamer3D.exe`; esse diretório segue fora
  do Git.

## Verificação

- Testes unitários da escolha de porta, espera do servidor e desligamento
  coordenado, sem abrir uma janela real durante a suíte.
- Testes existentes Python e JavaScript continuam passando.
- Validação manual do EXE: janela nativa abre, conteúdo Three.js carrega,
  FFmpeg é encontrado e o processo/porta são liberados ao fechar.

## Fora do escopo

- Não há mudança no fluxo da live, captura de canvas, música, chat público ou
  lógica dos dez personagens.
- Não será introduzido Electron nem uma conta, instalação ou serviço Windows.
