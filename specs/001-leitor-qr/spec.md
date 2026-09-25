# Especificação: Leitor de QR leve

**Pasta:** `specs/001-leitor-qr` · **Status:** Esclarecida · **Criada em:** 2026-09-25 · **Depende de:** —
**Detalha:** `specs/000-refatoracao/spec.md` → H1, RF-001, RF-002, RNF-002

## Contexto

No Samsung da operação a leitura da etiqueta demora ou não acontece. A etiqueta traz 12+ campos num QR de
cerca de 1 cm: um código pequeno e denso, que precisa de **resolução** para ser lido. O leitor atual reduz
cada frame e tenta até 8 variações da imagem, o que sobrecarrega o celular sem ganhar resolução. Ele também
carrega duas bibliotecas de QR (zxing 329 KB e jsQR 128 KB).

## Histórias de usuário

### H1 — Leitura ao vivo (P1)

**Como** revisor, **quero** apontar a câmera e ter a etiqueta lida sozinha, **para** começar a revisão em
segundos.

**Teste independente:** página de teste com o leitor isolado, 20 etiquetas reais.

**Cenários de aceite:**
1. **Dado** a câmera aberta e uma etiqueta legível dentro da moldura, **quando** seguro o celular a 10–20 cm,
   **então** o celular vibra e os dados aparecem em ≤ 3 s.
2. **Dado** que o leitor leu, **então** a câmera é desligada imediatamente.
3. **Dado** um ambiente escuro, **quando** toco na lanterna, **então** ela liga (se o aparelho suportar).

### H2 — Leitura por foto (P1)

**Como** revisor, **quero** fotografar a etiqueta quando a leitura ao vivo não funcionar, **para** não
depender de acertar o foco.

**Cenários de aceite:**
1. **Dado** que a leitura ao vivo não leu em 4 s, **então** aparece o botão "Fotografar etiqueta" em destaque.
2. **Quando** toco nele, **então** abre a câmera nativa do celular; ao confirmar a foto, os dados aparecem
   em ≤ 3 s.
3. **Dado** que a foto não tem QR legível, **então** vejo "Não encontrei o código nesta foto. Tente mais
   perto ou digite os dados." com as duas opções.

### H3 — Digitação (P2)

**Como** revisor, **quero** digitar os dados principais quando a etiqueta estiver danificada.

**Cenários de aceite:**
1. **Quando** escolho "Digitar", **então** informo NF, código do produto e lote (obrigatórios) e fornecedor
   (opcional) e sigo a revisão.

### H4 — Etiqueta em qualquer formato aceito hoje (P1)

**Cenários de aceite:**
1. **Dado** um texto em qualquer um dos formatos do legado (JSON, URL com parâmetros, `chave=valor` ou
   `chave:valor` por linha, posicional com `;` e 12+ campos), **então** os campos são interpretados igual
   ao legado (`parseQrCodeDataV2` + `normalizeQrPayload`).
2. **Dado** um texto em formato desconhecido, **então** vejo o texto lido e a opção de digitar.

## Casos de borda

- Permissão de câmera negada → mensagem explicando como liberar no Chrome + opções foto/digitar.
- Navegador sem detector nativo (Chrome desatualizado ou outro navegador) → usar o leitor alternativo
  carregado só nesse caso e mostrar uma vez a dica "Atualize o Chrome para ler mais rápido".
- Duas etiquetas no enquadramento → usar a mais próxima do centro.
- Usuário sai da tela com a câmera aberta → câmera desligada.

## Requisitos funcionais

- **RF-001**: Oferecer três modos: vídeo, foto e digitação.
- **RF-002**: Mostrar o botão de foto após 4 s sem leitura no vídeo.
- **RF-003**: Interpretar os formatos de etiqueta do legado com resultado idêntico.
- **RF-004**: Devolver ao restante da tela os dados interpretados, o texto bruto e a origem (vídeo/foto/digitado).
- **RF-005**: Desligar a câmera ao ler, ao cancelar e ao sair da página.

## Requisitos não funcionais

- **RNF-001**: Leitor + interpretação com ≤ 15 KB de código próprio; nenhuma biblioteca carregada quando o
  detector nativo existir.
- **RNF-002**: 20 de 20 etiquetas reais lidas em ≤ 3 s (vídeo ou foto) no Samsung da operação.
- **RNF-003**: Uso de CPU que não trave a interface (animação da moldura sem engasgos).

## Fora do escopo

- Leitura de código de barras 1D.
- Leitura de várias etiquetas em sequência (lote).

## Critérios de sucesso

- **CS-001**: 20/20 etiquetas reais em ≤ 3 s.
- **CS-002**: Tempo mediano de leitura ao vivo ≤ 1,5 s.
- **CS-003**: Remoção de zxing, `reviewer_scanner_js`, `service-worker` e `offline-manager` sem perda de
  funcionalidade usada.

## Esclarecimentos

| Data | Pergunta | Resposta |
|---|---|---|
| 2026-09-25 | Qual o modelo exato do Samsung da operação e a versão do Chrome? | é um samsung a alguma coisa, um modelo antigo com 6 de ram, bem fraquinho. |
| 2026-09-25 | Os revisores abrem o app pelo Chrome ou pelo Samsung Internet? | os revisores vao usar pelo google chrome |

Consequências:
- Alvo de desempenho: Galaxy linha A antigo, 6 GB de RAM. O leitor limita o processamento a um recorte
  de ~650 px por vez, no máximo ~8 leituras por segundo, e para a câmera assim que lê.
- Chrome é o navegador oficial: o `BarcodeDetector` nativo é o caminho principal. O jsQR continua como
  reserva, carregado só se o detector não existir (ex.: Chrome desatualizado).
- Anotar o modelo exato (Configurações → Sobre o telefone) e a versão do Chrome na tarefa 001-T17.

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação
- [x] Requisitos testáveis
- [x] Critérios mensuráveis
- [x] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
