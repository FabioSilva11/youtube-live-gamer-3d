# Palco animado, ranking com fotos e terreno aprimorado

## Objetivo

Permitir que o operador escolha animações de entrada e saída, mostrar os novos participantes individualmente antes de entrarem no grupo, exibir no próprio canvas um ranking com fotos públicas temporárias e enriquecer o mundo de primavera.

## Dados do chat

O leitor público extrai a miniatura pública do autor junto do nome, canal e papel. A URL permanece somente na memória do servidor enquanto o participante está ativo. O navegador recebe apenas `profile_image_available`; a imagem é carregada por `/api/profile-image/{avatar_id}`, que aceita somente hosts HTTPS do Google/YouTube e não grava arquivos.

## Animações

O painel oferece duas opções de entrada: `Atual`, que mantém o deslocamento existente, e `Apresentação individual`, que coloca cada novo avatar sozinho na entrada por cerca de 1,1 segundo e depois o move ao grupo. Uma fila garante uma apresentação por vez. A saída oferece `Atual`, que remove imediatamente, e `Caminhar para fora`, que move o avatar até a borda antes de removê-lo.

As escolhas ficam em `localStorage` e valem para as próximas entradas e saídas. Alterar a entrada para `Atual` libera imediatamente a fila pendente.

## Ranking no vídeo

O ranking dos cinco autores ativos com mais mensagens é desenhado em um segundo canvas, convertido em `CanvasTexture` e renderizado em uma cena ortográfica após o mundo 3D. Assim nome, pontuação e foto entram em `renderer.domElement.captureStream()` e aparecem no YouTube. Uma lista DOM oculta mantém a informação acessível.

## Terreno

O gramado recebe ondulação determinística, ilha-base, trilha, lago, pedras e arbustos. `terrainHeightAt(x, z)` é a fonte única da altura usada pela malha, flores, árvores e destinos dos avatares, evitando objetos flutuando ou enterrados.

## Verificação

Testes Python cobrem foto temporária, expiração e bloqueio de hosts. Testes Node cobrem modos, fila, ranking e altura. O navegador valida as opções, os 18 modelos, o ranking dentro do canvas e responsividade. A suíte completa e a compilação Python precisam terminar sem falhas.
