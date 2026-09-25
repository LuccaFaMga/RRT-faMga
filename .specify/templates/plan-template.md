# Plano técnico: [NOME DA ENTREGA]

**Spec:** `specs/NNN-nome/spec.md` · **Status:** Rascunho · **Data:** AAAA-MM-DD

## Resumo

[Requisito principal + abordagem técnica em 3–5 linhas.]

## Contexto técnico

- **Plataforma:** Google Apps Script (V8) + HtmlService; cliente Chrome Android
- **Armazenamento:** Google Sheets (abas em `specs/000-refatoracao/data-model.md`), Google Drive
- **Testes:** `npm test`
- **Restrições:** [cotas, tamanho de página, tempo de resposta]

## Portão da Constituição

| Artigo | Atende? | Observação / exceção justificada |
|---|---|---|
| I — Só o problema entra | ☐ | |
| II — Celular mais fraco | ☐ | |
| III — Coesão por área | ☐ | |
| IV — Infra burra, domínio puro | ☐ | |
| V — Um caminho de entrada | ☐ | |
| VI — Nada no global | ☐ | |
| VII — Teste antes de regra | ☐ | |
| VIII — Segurança | ☐ | |
| IX — Simplicidade mensurável | ☐ | |
| X — Produção nunca para | ☐ | |

## Pesquisa e decisões

| Decisão | Alternativas avaliadas | Motivo |
|---|---|---|

## Arquivos

| Ação | Caminho | Conteúdo |
|---|---|---|
| Criar | `src/...` | |
| Alterar | | |
| Adaptar (legado) | | adaptador de 1 linha |
| Remover | | |

## Contratos

[Ações de `api()` criadas/alteradas — atualizar `specs/000-refatoracao/contracts/api.md`.]

## Dados

[Abas/colunas criadas ou alteradas — atualizar `specs/000-refatoracao/data-model.md`.]

## Estratégia de migração e reversão

[Como liga em teste, como liga em produção, como volta atrás.]

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|

## Balanço de linhas

| Antes | Depois (estimado) | Diferença |
|---|---|---|
