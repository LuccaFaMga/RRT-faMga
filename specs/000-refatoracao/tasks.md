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
- [ ] 000-T05 Criar o **projeto de teste**: no Drive, "Fazer uma cópia" do projeto Apps Script; copiar o `scriptId` da cópia para `.clasp.teste.json`; nas Script Properties da cópia, apontar `SHEET_ID`, `OUTPUT_FOLDER_ID` etc. para as cópias de teste; implantar como app da Web — Apps Script — app de teste abre e grava só na planilha de teste (roteiro no README)
- [ ] 000-T06 Conferir que `SECRET_KEY` existe nas Script Properties de produção e teste (agora é gerada e salva automaticamente no primeiro acesso após o push da T07) — Apps Script — link assinado gerado hoje ainda valida no dia seguinte
- [x] 000-T07 `core/Config.js`: uma única leitura das Script Properties por execução (antes ~20), `SECRET_KEY` gerada uma vez e salva se não existir, e `configurarPropriedades_()` para copiar os padrões às Properties (rodar 1x no editor). Remoção dos padrões do código fica para a 002 — `core/Config.js` — verificado com dublê: 1 leitura, mesma chave em execuções seguidas
- [ ] 000-T08 [P] Exportar os cabeçalhos reais de todas as abas (função pronta no README, seção "Exportar cabeçalhos") — `specs/000-refatoracao/cabecalhos-atuais.md` — arquivo lista todas as abas
- [ ] 000-T09 [P] Coletar 20 etiquetas reais (texto bruto do QR + foto) e 5 rolos com medidas conferidas à mão — `tests/fixtures/etiquetas/` — arquivos presentes, sem dados pessoais
- [x] 000-T10 Criar `package.json` mínimo (sem dependências) com `npm test` (`node --test "tests/**/*.test.js"`, Node 22+) — `package.json` — `npm test` roda o teste legado
- [x] 000-T11 Teste de colisão de nomes globais (`tests/colisao-globais.test.js` + `tests/ferramentas/globais.js`): falha em qualquer repetição nova; as 5 do legado ficam listadas até a 006 — verde
- [x] 000-T12 Escrever `README.md` com: como rodar testes, como fazer `clasp push` para **teste**, quem publica em produção — `README.md`

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
