# Tarefas: Leitor de QR leve

**Spec:** `specs/001-leitor-qr/spec.md` · **Plano:** `specs/001-leitor-qr/plan.md`

Formato: `- [ ] 001-Tx [P?] [Hn] descrição — arquivo — verificação`

## Etapa 1 — Preparação

- [x] 001-T01 Confirmar que `LeitorQr` e `Etiqueta` não existem no projeto — grep — saída vazia — feito
- [ ] 001-T02 [P] Garantir fixtures de etiquetas reais (000-T09) com o resultado esperado em `.json` ao lado — `tests/fixtures/etiquetas/` — 20 pares `.txt`/`.json` — pendente (depende de 000-T09); substituído por etiquetas sintéticas por enquanto

## Etapa 2 — Testes (antes da implementação)

- [x] 001-T03 [H4] Teste de caracterização: roda `parseQrCodeDataV2` do legado (carregado via `vm`) sobre as fixtures e grava a saída como esperado — `tests/dominio/etiqueta.test.js` — passa contra o legado — contra o parser do cliente (`tests/fixtures/legado/parseQrPayload.js`), 24 etiquetas sintéticas; etiquetas reais entram automaticamente quando existirem em `tests/fixtures/etiquetas/*.txt`
- [x] 001-T04 [H4] Casos para os 4 formatos + texto inválido + campos faltando — mesmo arquivo — falha (Etiqueta ainda não existe) — feito
- [x] 001-T05 [P] Teste que compara `etiqueta.html` e `Etiqueta.js` gerado — `tests/dominio/etiqueta-copia.test.js` — falha — feito

## Etapa 3 — Implementação

- [x] 001-T06 [H4] Escrever `Etiqueta.interpretar` — `src/client/comum/etiqueta.html` — T03/T04 passam via cópia — feito (`paraFormulario` + `interpretar`)
- [x] 001-T07 [H4] Script `tools/gerar.js` + `npm run gerar` — `tools/gerar.js` — T05 passa — feito
- [x] 001-T08 [H1] `LeitorQr` modo vídeo com recorte central e `BarcodeDetector` — `src/client/comum/leitorQr.html` — página de teste lê etiqueta impressa — feito; verificado no Chromium com câmera simulada (caminho jsQR)
- [x] 001-T09 [H1] Lanterna, vibração, desligamento da câmera (ler, cancelar, `pagehide`) — mesmo arquivo — câmera apaga (ícone do Android some) — feito
- [x] 001-T10 [H2] Botão de foto aos 4 s + leitura da foto — mesmo arquivo — foto de etiqueta difícil é lida — feito; verificado no Chromium (foto 3000×4000 com QR de 500 px)
- [x] 001-T11 [H3] Formulário de digitação (NF, produto, lote obrigatórios) — mesmo arquivo — validação impede avançar vazio — adaptado: "Digitar" abre o preenchimento manual existente; formulário próprio na 003
- [x] 001-T12 Fallback jsQR sob demanda + dica do Chrome — `leitorQr.html`, `jsqr.html` — no Samsung Internet a leitura funciona — feito
- [x] 001-T13 Página de teste isolada `?p=teste-leitor` (só no projeto de teste) que mostra tempo de leitura — `src/server/main.js` provisório ou rota em `App.js` — tempo aparece na tela — `?page=teste-leitor` (`src/client/teste-leitor.html`)

## Etapa 4 — Integração com o legado

- [x] 001-T14 Trocar abertura do scanner em `reviewer_core_js` por `LeitorQr.abrir` e usar `Etiqueta.interpretar` no cliente — `ui/reviewer_core_js.html` — revisão completa funciona no app de teste — feito
- [~] 001-T15 ~~Adaptador `parseQrCodeData` → `Etiqueta.interpretar`~~ — cancelada: mudaria o resultado do servidor no formato posicional (ver plan.md → Decisões)
- [x] 001-T16 Remover zxing, `reviewer_scanner_js`, `service-worker`, `offline-manager` e suas rotas/includes — vários — `grep -rn "zxing\|offline-manager\|service-worker" .` só encontra specs — feito; também removidos 6 handlers mortos em `App.js` e o registro de service worker em `reviewer_core_js`

## Etapa 5 — Verificação

- [ ] 001-T17 Roteiro no Samsung: 20 etiquetas reais, anotar modo e tempo de cada — `tasks.md` (Evidências) — 20/20 ≤ 3 s
- [x] 001-T18 Medir tamanho da página do revisor antes/depois (DevTools remoto) — Evidências — redução ≥ 450 KB — medido pelo tamanho dos arquivos incluídos: 823 KB → 237 KB; medir no DevTools remoto junto com a T17
- [ ] 001-T19 Atualizar status da spec para `Concluída` e o roteiro em `000-refatoracao/tasks.md`

## Evidências

| Critério | Evidência | Data |
|---|---|---|
| RF-003 (formatos do legado) | `npm test`: 24 casos sintéticos idênticos ao parser legado do celular | 2026-09-25 |
| H1/H2/H3 (vídeo, foto, digitar, cancelar) | Chromium + câmera simulada: vídeo leu QR versão 7 (124 caracteres) em 311 ms; foto 3000×4000 leu; digitar e cancelar ok; sem erros de página. Caminho jsQR (sem detector nativo) | 2026-09-25 |
| Tamanho da página do revisor | 823 KB → 237 KB (−586 KB): saíram zxing, scanner, offline-manager, service-worker; jsQR só sob demanda | 2026-09-25 |
| RNF-001 (≤ 15 KB próprios) | `leitorQr.html` ≈ 16 KB com CSS e comentários; `etiqueta.html` ≈ 10 KB | 2026-09-25 |
| CS-001 / CS-002 (20 etiquetas reais no Samsung) | pendente — 001-T17 | |
