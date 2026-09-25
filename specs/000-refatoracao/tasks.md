# Tarefas: Refatoração do RRT Tecidos (roteiro geral)

**Spec:** `specs/000-refatoracao/spec.md` · **Plano:** `specs/000-refatoracao/plan.md`

Este arquivo tem as tarefas da **Fase 0** e o roteiro das entregas. As tarefas de cada entrega ficam em
`specs/NNN-nome/tasks.md`, criadas depois que a spec da entrega estiver `Esclarecida`.

Formato: `- [ ] ID [P?] descrição — arquivo — verificação`

## Fase 0 — Rede de segurança (~1 dia)

- [x] 000-T01 Ligar a pasta ao repositório `LuccaFaMga/RRT-faMga`, substituir a main pelo código atual e marcar `v-legado` (main anterior na tag `antes-da-refatoracao`) — raiz — feito em 2026-09-25; falta `git push origin main --tags` pelo dono
- [x] 000-T02 [P] Criar `.gitignore` (node_modules, .clasprc.json, arquivos do SO) — `.gitignore` — `git status` limpo
- [x] 000-T03 Resolver os `[PRECISA ESCLARECER]` principais com o Lucca (gerente, perfis, numeração) — `spec.md` — respondido em 2026-09-25
- [x] 000-T03b Resolver as pendências restantes de `spec.md` (dois revisores, rolo relido, estoque, Power BI, e-mail de compras) — `spec.md` — respondido em 2026-09-25
- [ ] 000-T04 Copiar a planilha e a pasta de saída do Drive para versões **TESTE** — Drive — IDs anotados (fora do repositório)
- [ ] 000-T05b Definir `EMAIL_COMPRAS` nas Script Properties (teste e produção) com o e-mail do dono por enquanto — Apps Script — e-mail de teste chega
- [ ] 000-T05 Criar implantação **teste** do projeto e definir Script Properties apontando para a planilha/pasta de teste — Apps Script — app de teste abre e grava só na planilha de teste
- [ ] 000-T06 Definir `SECRET_KEY` fixa nas Script Properties de produção e teste — Apps Script — link assinado gerado hoje ainda valida no dia seguinte
- [ ] 000-T07 Mover os valores padrão de `core/Config.js` para Script Properties e trocar as ~20 chamadas de `loadConfigFromProperties()` por uma única leitura — `core/Config.js` — app funciona igual; `grep -c loadConfigFromProperties core/Config.js` = 2
- [ ] 000-T08 [P] Exportar os cabeçalhos reais de todas as abas — `specs/000-refatoracao/cabecalhos-atuais.md` — arquivo lista todas as abas
- [ ] 000-T09 [P] Coletar 20 etiquetas reais (texto bruto do QR + foto) e 5 rolos com medidas conferidas à mão — `tests/fixtures/etiquetas/` — arquivos presentes, sem dados pessoais
- [ ] 000-T10 Criar `package.json` mínimo (sem dependências) com script `test: node --test tests/` — `package.json` — `npm test` roda o teste legado
- [ ] 000-T11 Criar teste de colisão: carrega todos os `.js` do projeto num contexto `vm` e lista nomes globais duplicados — `tests/colisao-globais.test.js` — hoje falha listando os 13 duplicados (esperado; vira verde na 006)
- [ ] 000-T12 Escrever `README.md` com: como rodar testes, como fazer `clasp push` para **teste**, quem publica em produção — `README.md` — outra pessoa consegue seguir

## Roteiro das entregas

| Ordem | Entrega | Pasta | Status |
|---|---|---|---|
| 1 | Leitor de QR leve | `specs/001-leitor-qr/` | Rascunho |
| 2 | Base do servidor | `specs/002-base-servidor/` | Rascunho |
| 3 | Tela do revisor | `specs/003-tela-revisor/` | Rascunho |
| — | ~~Tela do gerente~~ | `specs/004-tela-gerente/` | Cancelada (2026-09-25) |
| 5 | Tela de compras e PDF | `specs/005-tela-compras/` | Rascunho |
| 6 | Limpeza e virada | `specs/006-limpeza-virada/` | Rascunho |

001 e 002 podem andar em paralelo. 003 precisa das duas. 005 precisa de 002 e 003.

## Evidências

| Critério | Evidência | Data |
|---|---|---|
