# Tarefas: Leitor de QR leve

**Spec:** `specs/001-leitor-qr/spec.md` · **Plano:** `specs/001-leitor-qr/plan.md`

Formato: `- [ ] 001-Tx [P?] [Hn] descrição — arquivo — verificação`

## Etapa 1 — Preparação

- [ ] 001-T01 Confirmar que `LeitorQr` e `Etiqueta` não existem no projeto — grep — saída vazia
- [ ] 001-T02 [P] Garantir fixtures de etiquetas reais (000-T09) com o resultado esperado em `.json` ao lado — `tests/fixtures/etiquetas/` — 20 pares `.txt`/`.json`

## Etapa 2 — Testes (antes da implementação)

- [ ] 001-T03 [H4] Teste de caracterização: roda `parseQrCodeDataV2` do legado (carregado via `vm`) sobre as fixtures e grava a saída como esperado — `tests/dominio/etiqueta.test.js` — passa contra o legado
- [ ] 001-T04 [H4] Casos para os 4 formatos + texto inválido + campos faltando — mesmo arquivo — falha (Etiqueta ainda não existe)
- [ ] 001-T05 [P] Teste que compara `etiqueta.html` e `Etiqueta.js` gerado — `tests/dominio/etiqueta-copia.test.js` — falha

## Etapa 3 — Implementação

- [ ] 001-T06 [H4] Escrever `Etiqueta.interpretar` — `src/client/comum/etiqueta.html` — T03/T04 passam via cópia
- [ ] 001-T07 [H4] Script `tools/gerar.js` + `npm run gerar` — `tools/gerar.js` — T05 passa
- [ ] 001-T08 [H1] `LeitorQr` modo vídeo com recorte central e `BarcodeDetector` — `src/client/comum/leitorQr.html` — página de teste lê etiqueta impressa
- [ ] 001-T09 [H1] Lanterna, vibração, desligamento da câmera (ler, cancelar, `pagehide`) — mesmo arquivo — câmera apaga (ícone do Android some)
- [ ] 001-T10 [H2] Botão de foto aos 4 s + leitura da foto — mesmo arquivo — foto de etiqueta difícil é lida
- [ ] 001-T11 [H3] Formulário de digitação (NF, produto, lote obrigatórios) — mesmo arquivo — validação impede avançar vazio
- [ ] 001-T12 Fallback jsQR sob demanda + dica do Chrome — `leitorQr.html`, `jsqr.html` — no Samsung Internet a leitura funciona
- [ ] 001-T13 Página de teste isolada `?p=teste-leitor` (só na implantação de teste) que mostra tempo de leitura — `src/server/main.js` provisório ou rota em `App.js` — tempo aparece na tela

## Etapa 4 — Integração com o legado

- [ ] 001-T14 Trocar abertura do scanner em `reviewer_core_js` por `LeitorQr.abrir` e usar `Etiqueta.interpretar` no cliente — `ui/reviewer_core_js.html` — revisão completa funciona no app de teste
- [ ] 001-T15 Adaptador `parseQrCodeData` → `Etiqueta.interpretar` — `App/App.js` — teste legado continua verde
- [ ] 001-T16 Remover zxing, `reviewer_scanner_js`, `service-worker`, `offline-manager` e suas rotas/includes — vários — `grep -rn "zxing\|offline-manager\|service-worker" .` só encontra specs

## Etapa 5 — Verificação

- [ ] 001-T17 Roteiro no Samsung: 20 etiquetas reais, anotar modo e tempo de cada — `tasks.md` (Evidências) — 20/20 ≤ 3 s
- [ ] 001-T18 Medir tamanho da página do revisor antes/depois (DevTools remoto) — Evidências — redução ≥ 450 KB
- [ ] 001-T19 Atualizar status da spec para `Concluída` e o roteiro em `000-refatoracao/tasks.md`

## Evidências

| Critério | Evidência | Data |
|---|---|---|
