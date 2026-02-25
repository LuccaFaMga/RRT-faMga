# Sprints — Evolução da Página de Estoque

## Objetivo
Transformar o dashboard de estoque em uma ferramenta mais decisória, com indicadores confiáveis, visão temporal e ações operacionais.

## Sprint 1 — Confiabilidade de KPIs e Base Analítica

**Status:** ✅ Concluída (25/02/2026)

### Escopo
1. Calcular **Tempo Médio de Compras** com dados reais (remover valor fixo).
2. Padronizar cálculo de status de compras (pendente / negociação / resolvido).
3. Garantir atualização consistente dos KPIs na carga inicial e nos filtros.

### Entregas realizadas
- Tempo médio de compras com cálculo real e fallback seguro.
- Pipeline único para status e KPIs de compras (render, filtros e cards).
- Indicador de contexto de filtro (visão total vs filtro ativo).
- Carimbo de última atualização com contexto.
- Auto-refresh silencioso com intervalo configurável (0/30/45/60s) e persistência.
- Indicador visual de estado do auto-refresh e registro de último auto-refresh executado.

### Critérios de aceite
- KPI `Tempo Médio` em Compras não pode usar valor hardcoded.
- Quando houver casos resolvidos com timestamps válidos, exibir valor em dias com 1 casa decimal.
- Quando não houver base válida, exibir `-`.
- Nenhum erro novo de JavaScript no arquivo de estoque.

### Riscos
- Inconsistência de campos de data entre documentos históricos.
- Casos sem data de início/fim.

---

## Sprint 2 — Dashboard Decisório

**Status:** ✅ Concluída (25/02/2026)

### Escopo
1. Adicionar visão temporal (7/30/90 dias) para reprovação e backlog.
2. Exibir variação vs período anterior nos KPIs principais.
3. Melhorar alertas com severidade e foco em ação.

### Entrega 1 concluída
- Seletor de período 7/30/90 dias na aba Visão Geral.
- Cálculo de métricas da janela atual comparado com a janela anterior equivalente.
- Exibição de delta (pp) para Taxa de Reprovação e Pendências.

### Entrega 2 concluída
- Comparação percentual vs período anterior adicionada nos cards de topo (Reprovação, Defeitos/100m e Pendências).
- Alertas do cabeçalho ajustados para texto acionável com recomendação objetiva de próximo passo.

### Entrega 3 concluída
- Severidade dos alertas ajustada por impacto (critical/warning) com score de priorização.
- Ordenação por impacto e limite de exibição para foco operacional.
- CTA por aba nos alertas (Análise do Supervisor, Compras e Métricas de Qualidade).

### Entrega 4 concluída
- Calibragem de thresholds dos alertas por volume da base e período selecionado (7/30/90).
- Substituição de limites fixos por limiares adaptativos para reduzir ruído operacional.

### Critérios de aceite
- Pelo menos 2 séries temporais com período selecionável.
- KPI principal com comparação percentual contra período anterior.
- Alertas com texto acionável (não apenas informativo).

---

## Sprint 3 — Planejamento e Ação

**Status:** ✅ Concluída (25/02/2026)

### Escopo
1. Nova aba de **Reposição / Risco de Ruptura**.
2. Sugestão de compra por item crítico (prioridade por cobertura).
3. Exportação da lista crítica para operação.

### Entrega 1 concluída
- Nova aba de Reposição / Risco de Ruptura no dashboard.
- Lista crítica inicial com priorização por nível de risco e justificativa.
- Sugestão de compra por item e exportação CSV da lista crítica.

### Entrega 2 concluída
- Prioridade refinada por cobertura estimada em dias com base no histórico recente de corte.
- Inclusão de faixa de risco de ruptura (imediata/crítico/alto/moderado) por item.
- Exportação CSV expandida com consumo médio diário e cobertura estimada.

### Entrega 3 concluída
- Ranking consolidado por fornecedor na aba de Reposição/Risco.
- Score de risco por fornecedor combinando criticidade, prioridade e volume sugerido.
- Visibilidade da pior cobertura por fornecedor para apoiar negociação de compra.

### Critérios de aceite
- Lista de itens críticos com prioridade e justificativa.
- Filtro por fornecedor e tipo.
- Exportação CSV funcional.

---

## Sprint 4 — Governança e Produtividade

**Status:** ✅ Concluída (25/02/2026)

### Escopo
1. Filtros salvos por usuário.
2. Exibir “última atualização” e rastreabilidade de cálculo dos KPIs.
3. Base para notificações proativas (e-mail interno).

### Entrega 1 concluída
- Persistência de filtros por usuário via localStorage nos principais blocos (Estoque, Análise, Compras, Reposição e períodos de visão/métricas).
- Reaplicação automática dos filtros salvos após carga dos dados do dashboard.

### Entrega 2 concluída
- Painel curto de rastreabilidade dos KPIs no topo (fonte, janela de cálculo, base utilizada, criticidade e timestamp).
- Atualização automática da trilha de cálculo sempre que `updateStats` recalcula indicadores.

### Entrega 3 concluída
- Base de notificações proativas implementada com gatilhos a partir dos alertas críticos priorizados.
- Geração de payload estruturado (tipo, severidade, ação recomendada, CTA e timestamp).
- Fila local deduplicada e pronta para futura integração de envio interno.

### Entrega 4 concluída
- Integração ponta a ponta da fila proativa com endpoint interno `sendProactiveNotifications_Web`.
- Envio em lote com cooldown no cliente para evitar duplicidade e excesso de disparos.
- Serviço de digest interno por e-mail com destinatários de `ADMIN`, `SUPERVISOR` e `COMPRAS`.

### Critérios de aceite
- Usuário consegue salvar e reaplicar filtros.
- Dashboard informa timestamp da última atualização.
- Logs mínimos para auditoria de indicadores.

---

## Definição de pronto (DoD)
- Sem regressão visual relevante na página.
- Sem erros novos no console principal do fluxo.
- Exportações existentes continuam funcionando.
- Revisão rápida de consistência com dados reais do ambiente.
