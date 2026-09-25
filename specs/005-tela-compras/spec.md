# Especificação: Tela de compras

**Pasta:** `specs/005-tela-compras` · **Status:** Rascunho (rev. 2 — recebe direto do revisor) · **Criada em:** 2026-09-25 · **Depende de:** 002, 003
**Detalha:** `specs/000-refatoracao/spec.md` → H3, RF-008, CS-003, CS-004

## Contexto

Com a etapa do gerente removida (2026-09-25), compras passa a ser o único destino dos rolos com problema. O
PDF já chega por e-mail no momento em que o revisor conclui (entrega 003). Esta tela serve para compras
**ver o caso em detalhe**, **acrescentar sua observação** ao PDF quando precisar e **registrar o retorno** do
fornecedor.

Hoje isso está espalhado entre `compras.html`, abas de `estoque.html` (7.279 linhas), `supervisor.html`, duas
implementações de PDF e dois fluxos de decisão ("V2" e "Legacy").

## Histórias de usuário

### H1 — Casos em aberto (P1)

**Como** compras, **quero** ver os rolos que estão comigo, os mais antigos primeiro.

**Cenários de aceite:**
1. **Quando** abro a tela, **então** vejo os rolos em `EM_COMPRAS` com fornecedor, NF, produto, lote,
   pontuação vs. limite, revisor, quantidade de fotos, se o PDF existe e há quanto tempo estão comigo.
2. **Dado** um rolo sem PDF (falha na conclusão), **então** ele aparece destacado com "PDF pendente".
3. **Quando** marco "mostrar encerrados", **então** vejo também `LIBERADO` e `DEVOLVIDO`, com o resultado.
4. **Dado** o link do e-mail (`?p=compras&rolo=REV-…`), **quando** abro, **então** caio direto no rolo.
5. **Dado** nenhum caso aberto, **então** vejo "Nenhum rolo aguardando compras".

### H2 — Ver o caso em detalhe (P1)

**Cenários de aceite:**
1. **Quando** abro um rolo, **então** vejo dados da etiqueta, medidas, defeitos (metros, gravidade, zona),
   pontuação com limite e alertas, observação do revisor, histórico e fotos.
2. **Quando** toco numa foto, **então** ela abre em tela cheia com zoom e posso passar para a próxima.
3. **Então** tenho o botão "Abrir PDF" (se existir).

### H3 — PDF com a observação de compras (P1)

**Cenários de aceite:**
1. **Quando** escrevo uma observação e toco em "Gerar PDF", **então** em ≤ 15 s o PDF é refeito com a
   observação e abre.
2. **Dado** um rolo com "PDF pendente", **quando** toco em "Gerar PDF", **então** o PDF é criado.
3. **Então** o PDF contém, nesta ordem: cabeçalho com logo e número da revisão; fornecedor e NF; produto
   (código, código do fornecedor, lote, cor, padronagem, composição); medidas (metros fornecedor × revisado,
   largura, peso); tabela de defeitos; pontuação com limite de referência e alertas; observação do revisor;
   observação de compras (se houver); fotos (2 por página, com legenda do defeito); rodapé com data de
   geração, nome do revisor e página X de Y.

### H4 — Registrar o retorno do fornecedor (P1)

**Cenários de aceite:**
1. **Quando** registro "Aceito" ou "Abatimento" com observação, **então** o rolo vai para `LIBERADO`.
2. **Quando** registro "Devolução", **então** o rolo vai para `DEVOLVIDO`.
3. **Então** a confirmação é feita na própria tela (sem janela do navegador) e o rolo sai da lista de abertos.

## Casos de borda

- Rolo com 30 fotos → PDF gerado sem estourar tempo (fotos reduzidas para o PDF); miniaturas carregam aos
  poucos na tela.
- Foto apagada no Drive → espaço "foto indisponível" na tela e no PDF.
- Duas pessoas registram retorno do mesmo rolo → a segunda vê quem registrou e quando; nada é alterado.

## Requisitos funcionais

- **RF-001**: Lista de casos abertos ordenada por tempo, com filtro de encerrados e destaque para PDF pendente.
- **RF-002**: Detalhe completo com galeria e histórico.
- **RF-003**: Regerar o PDF com observação de compras (substitui o anterior).
- **RF-004**: Registro do retorno com três resultados.
- **RF-005**: Link direto por `?p=compras&rolo=REV-…`.

## Requisitos não funcionais

- **RNF-001**: PDF ≤ 15 s e ≤ 10 MB com 30 fotos.
- **RNF-002**: Lista abre em < 4 s com 50 casos. Funciona em computador e celular.

## Fora do escopo

- Envio automático do PDF ao fornecedor. [PRECISA ESCLARECER: compras envia por conta própria?]
- Dashboard de KPIs e métricas.

## Critérios de sucesso

- **CS-001**: Compras envia o PDF sem editar em 5 casos reais.
- **CS-002**: `compras.html` antigo, `supervisor.html`, `estoque.html`, `ComprasController.js`,
  `SupervisorController.js`, `processarDecisaoComprasV2_*`, `processSupervisorDecision*`,
  `generateComprasPDF_Web`, `generateReprovePDF_Web` removidos; `EmailService.js` reduzido a `infra/Email.js`.

## Esclarecimentos

| Data | Pergunta | Resposta |
|---|---|---|
| — | Existe um modelo visual (logo, cores, textos fixos) obrigatório para o PDF? | [PRECISA ESCLARECER] |
| — | "Abatimento" precisa registrar valor ou percentual? | [PRECISA ESCLARECER] |
| — | Regerar o PDF substitui o anterior ou guarda versões? | [PRECISA ESCLARECER — sugestão: substitui] |

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação
- [x] Requisitos testáveis
- [x] Critérios mensuráveis
- [ ] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
