# Plano técnico: Leitor de QR leve

**Spec:** `specs/001-leitor-qr/spec.md` · **Status:** Rascunho · **Data:** 2026-09-25

## Resumo

Novo módulo cliente `LeitorQr` com três degraus: (1) vídeo 1920×1080 com **recorte central sem redução**
entregue ao `BarcodeDetector` a cada ~120 ms via `requestVideoFrameCallback`; (2) `<input type="file"
accept="image/*" capture="environment">` para foto nativa, decodificada com `BarcodeDetector` sobre
`createImageBitmap`; (3) formulário de digitação. jsQR só é carregado dinamicamente quando
`'BarcodeDetector' in window` for falso. A interpretação da etiqueta sai do servidor e vira
`Etiqueta.interpretar`, código compartilhado cliente/servidor.

## Portão da Constituição

| Artigo | Atende? | Observação |
|---|---|---|
| I | ✅ | Serve ao trabalho do revisor |
| II | ✅ | ≤ 15 KB; sem biblioteca no caminho feliz |
| III | ✅ | `client/comum/leitorQr.js`, `dominio/Etiqueta.js` |
| IV | ✅ | `Etiqueta` é puro, testável em Node |
| V | ✅ | Leitor não chama o servidor |
| VI | ✅ | Namespaces `LeitorQr`, `Etiqueta` (verificar ausência no legado) |
| VII | ✅ | Testes de caracterização de `parseQrCodeDataV2` antes de portar |
| VIII | ✅ | — |
| IX | ✅ | −3.100 linhas, −329 KB |
| X | ✅ | Integração no legado por troca da função de abrir scanner |

## Pesquisa e decisões

| Decisão | Alternativas | Motivo |
|---|---|---|
| `BarcodeDetector` como principal | zxing-js, jsQR, html5-qrcode | Nativo no Chrome Android (ML Kit), rápido, 0 KB |
| Recorte central em resolução cheia | Reduzir frame inteiro | QR de 1 cm precisa de pixels; recorte mantém custo baixo |
| Foto nativa como 2º degrau | Aumentar zoom/refoco manual | Câmera nativa tem autofoco e 12 MP; mais confiável que ajustes via `applyConstraints` |
| jsQR sob demanda | zxing | Menor (128 KB vs 329 KB); só para navegador sem detector |
| `Etiqueta` compartilhado | Manter parse no servidor | Remove uma chamada de 1–3 s; mesma regra nos dois lados |

**Como compartilhar `Etiqueta` entre cliente e servidor:** o HtmlService só inclui arquivos `.html`, e o
servidor só executa `.js`. A fonte única fica em `src/client/comum/etiqueta.html` (um `<script>` sem APIs
do Google). O script `tools/gerar.js` (Node, sem dependências, `npm run gerar`) copia o corpo desse script
para `src/server/dominio/Etiqueta.js`. Um teste garante que as duas cópias são idênticas.

## Arquivos

| Ação | Caminho | Conteúdo |
|---|---|---|
| Criar | `src/client/comum/etiqueta.html` | `Etiqueta.interpretar(texto)` (fonte única) |
| Criar | `src/server/dominio/Etiqueta.js` | cópia gerada |
| Criar | `tools/gerar.js` | copia o corpo do script de `etiqueta.html` para `Etiqueta.js` |
| Criar | `src/client/comum/leitorQr.html` | `LeitorQr.abrir({ onLido }) → Promise<{texto, origem}>` + UI mínima |
| Criar | `src/client/comum/jsqr.html` | jsQR 1.4.0 minificado (movido de `ui/jsQR_js.html`), carregado sob demanda |
| Criar | `tests/dominio/etiqueta.test.js` | caracterização + casos novos |
| Criar | `tests/fixtures/etiquetas/*.txt` | textos reais (Fase 0, T09) |
| Alterar | `ui/reviewer_core_js.html` | ponto onde o scanner é aberto passa a chamar `LeitorQr.abrir` |
| Alterar | `ui/reviewer.html` | remove includes de zxing, scanner, offline-manager, service-worker; inclui `leitorQr` e `etiqueta` |
| Adaptar | `App/App.js#parseQrCodeData` | `return Etiqueta.interpretar(qrRaw)` |
| Remover | `ui/zxing_js.html`, `ui/reviewer_scanner_js.html`, `service-worker.html`, `offline-manager.html`, rotas correspondentes em `App.js` | |

## Detalhes do leitor (vídeo)

```
getUserMedia({ video: { facingMode: {ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080} } })
foco contínuo se `getCapabilities().focusMode` incluir 'continuous'
canvas quadrado LADO = min(videoWidth, videoHeight) * 0.6   (ex.: 648 px em 1080p)
a cada frame (requestVideoFrameCallback, com throttle de 120 ms e trava "ocupado"):
  ctx.drawImage(video, sx, sy, LADO, LADO, 0, 0, LADO, LADO)     // sem redução
  const r = await detector.detect(canvas)
  if (r.length) → escolher o mais próximo do centro → vibrar → parar tudo → resolver
aos 4 s sem leitura: destacar botão "Fotografar etiqueta"
```

Sem: variações de imagem, medição de brilho, refoco periódico, perfis por modelo, zoom automático.

## Detalhes do leitor (foto)

```
<input type=file accept="image/*" capture="environment">
file → createImageBitmap(file, { resizeWidth: ≤ 2400 mantendo proporção })
detector.detect(bitmap); se vazio, tentar no quadrado central ampliado 1× (um único retry)
```

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| `BarcodeDetector` ausente em algum aparelho | Média | jsQR sob demanda + dica do Chrome |
| 1080p não disponível na câmera | Baixa | Aceitar o que vier; foto nativa cobre |
| Cópia `Etiqueta` divergir | Baixa | Teste compara as duas |

## Balanço de linhas

| Antes | Depois | Diferença |
|---|---|---|
| ~3.550 (scanner, SW, offline, parse) | ~350 | ≈ −3.200 |
