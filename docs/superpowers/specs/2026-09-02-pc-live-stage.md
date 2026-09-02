# Palco 3D para live PC — especificação

## Objetivo

Entregar uma única saída de transmissão em 1280 × 720, com mapa e ranking legíveis, enquanto a prévia ocupa toda a área disponível sem esticar a imagem. Os avatares alternam exploração da ilha e interação social, oferecem mais estilos de entrada/saída e podem ter esses dois movimentos testados separadamente pelo painel.

## Requisitos aprovados

- Remover o seletor e todo o comportamento de formato para celular.
- Capturar a live exclusivamente em 1280 × 720 (16:9).
- Manter a prévia adaptável como continuação real do mundo 3D, sem alterar a proporção da captura.
- Preservar o mapa inteiro e o ranking dentro da área segura da live.
- Fazer cada avatar explorar pontos determinísticos e variados da ilha entre os encontros sociais.
- Entradas: apresentação individual, queda suave, portal giratório e entrada direta.
- Saídas: caminhar, subir, portal giratório e saída imediata.
- Expor os botões `Testar entrada` e `Testar saída`; a saída remove apenas o avatar de demonstração cujo nome está no campo.
- Manter os campos preenchidos após os testes.
- Liberar tracks, áudio, WebSocket e renderer auxiliar quando a captura parar ou a conexão de saída fechar.

## Critérios de aceite

- A interface não contém opção 9:16/celular.
- A captura usa canvas 1280 × 720 e a câmera 16:9, sem compressão por CSS.
- O ranking fica inteiramente dentro de 24 px das bordas do quadro capturado.
- Um ciclo social contém movimento de exploração e interação.
- Todos os novos modos são normalizados e testados.
- Entrada e saída demo funcionam individualmente e preservam o texto do campo.
- Testes Python, Node, compilação, diff check e console do navegador passam.

