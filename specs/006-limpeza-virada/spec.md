# Especificação: Limpeza e virada

**Pasta:** `specs/006-limpeza-virada` · **Status:** Rascunho (rev. 2 — sem perfis) · **Criada em:** 2026-09-25 · **Depende de:** 003, 005
**Detalha:** `specs/000-refatoracao/spec.md` → RNF-005, RNF-006, CS-005, CS-006

## Contexto

Com as duas telas novas prontas, o legado precisa sair sem deixar rolos em andamento órfãos e sem deixar o
app aberto a acesso anônimo.

## Histórias de usuário

### H1 — Nenhum rolo esquecido (P1)

**Como** compras, **quero** que os rolos que estavam em andamento no sistema antigo apareçam nas telas novas.

**Cenários de aceite:**
1. **Dado** rolos em estados do legado, **quando** a migração roda, **então** cada um passa ao estado novo
   pela tabela de `data-model.md` e ganha um evento em HISTORICO com observação "migração".
2. **Dado** rolos em `aguardando_supervisor` (que viram `EM_COMPRAS`) sem PDF, **então** o PDF é gerado e
   compras recebe um único e-mail com a lista desses rolos.
3. **Dado** que a migração roda duas vezes, **então** nada é duplicado.

### H2 — Acesso só com conta (P1)

**Cenários de aceite:**
1. **Dado** uma pessoa sem login Google, **quando** abre o link, **então** é pedida a conta.
2. **Dado** qualquer conta Google logada, **então** acessa as duas telas (não há perfis).
3. **Dado** as fotos antigas compartilhadas por link, **então** o compartilhamento público é removido.

### H3 — Código só do que é usado (P1)

**Cenários de aceite:**
1. **Então** o projeto não contém `App/`, `00services/`, `services/`, `controllers/`, `routers/`, `core/`,
   `ui/` nem adaptadores.
2. **Então** não existe mais código de controle de estoque (retiradas, solicitações de corte), Power BI
   (`handlePowerBIExport`, rota `export`) nem KPIs (`getKPIDashboardData`, rota `kpi_data`, métricas de
   revisores).
3. **Então** o teste de colisão de globais passa (apenas `doGet`, `api`, `include`).

## Requisitos funcionais

- **RF-001**: Script de migração idempotente, executado primeiro na planilha de teste.
- **RF-002**: Manifesto com `access: ANYONE` (qualquer conta Google logada) e `executeAs: USER_DEPLOYING`
  (decidido em 2026-09-25: sem perfis, sem login próprio).
- **RF-003**: Remoção do compartilhamento público das fotos antigas.
- **RF-004**: Links das rotas antigas (`?page=...`) redirecionam para as novas por 30 dias.
- **RF-005**: Trocar `EMAIL_COMPRAS` nas Script Properties de produção pelo e-mail real de compras e
  enviar um e-mail de teste.

## Requisitos não funcionais

- **RNF-001**: Virada em produção em janela combinada, com versão `v-legado` pronta para voltar.

## Fora do escopo

- Apagar as abas AUDIT, TELEMETRIA, TEMPOS_LOG (decisão posterior do dono).

## Critérios de sucesso

- **CS-001**: 0 rolos em estado do legado após a migração.
- **CS-002**: Projeto com ≤ 7.000 linhas.
- **CS-003**: 2 semanas de uso sem revisão perdida.

## Esclarecimentos

| Data | Pergunta | Resposta |
|---|---|---|

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação
- [x] Requisitos testáveis
- [x] Critérios mensuráveis
- [ ] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
