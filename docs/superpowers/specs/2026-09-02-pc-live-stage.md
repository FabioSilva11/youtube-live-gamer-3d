# Palco 3D para live PC — especificação

## Objetivo

Entregar perfis de transmissão econômico e normal, com mapa, ranking e QR legíveis. Fora da live a prévia ocupa toda a área disponível; durante a transmissão, ela mostra o mesmo canvas 16:9 capturado. Os avatares alternam exploração da ilha e interação social, oferecem mais estilos de entrada/saída e podem ter esses dois movimentos testados separadamente pelo painel.

## Requisitos aprovados

- Remover o seletor e todo o comportamento de formato para celular.
- Permitir escolher entre Econômico (854 × 480, 24 FPS) e Normal (1280 × 720, 30 FPS), com bitrates correspondentes.
- Manter a prévia adaptável fora da live e usar o próprio canvas 16:9 como prévia durante a captura.
- Preservar o mapa inteiro e o ranking dentro da área segura da live.
- Fazer cada avatar explorar pontos determinísticos e variados da ilha entre os encontros sociais.
- Entradas: apresentação individual, queda suave, portal giratório e entrada direta.
- Saídas: caminhar, subir, portal giratório e saída imediata.
- Expor os botões `Testar entrada` e `Testar saída`; a saída remove apenas o avatar de demonstração cujo nome está no campo.
- Manter os campos preenchidos após os testes.
- Liberar tracks, áudio e WebSocket, além de restaurar a câmera interativa, quando a captura parar ou a conexão de saída fechar.

## Critérios de aceite

- A interface não contém opção 9:16/celular.
- A captura usa o canvas principal nas dimensões e FPS do perfil selecionado, com câmera 16:9 e sem uma segunda renderização da cena.
- O ranking fica inteiramente dentro de 24 px das bordas do quadro capturado.
- Um ciclo social contém movimento de exploração e interação.
- Todos os novos modos são normalizados e testados.
- Entrada e saída demo funcionam individualmente e preservam o texto do campo.
- Testes Python, Node, compilação, diff check e console do navegador passam.
