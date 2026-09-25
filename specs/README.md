# Especificações (SDD)

Cada pasta é uma entrega. Ordem de leitura:

1. `../.specify/memory/constitution.md` — princípios
2. `000-refatoracao/` — especificação-mãe da refatoração (spec, plano, modelo de dados, contrato da API, roteiro)
3. `001` a `006` — entregas, na ordem (a `004` foi cancelada)

Fluxo do rolo (rev. 2): **revisor conclui → PDF + e-mail para compras → compras registra o retorno**.

| Pasta | Entrega | spec | plan | tasks | Status |
|---|---|---|---|---|---|
| 000-refatoracao | Refatoração (mãe) | ✅ | ✅ | ✅ (Fase 0 + roteiro) | Esclarecida |
| 001-leitor-qr | Leitor de QR leve | ✅ | ✅ | ✅ | Em desenvolvimento (falta teste no celular) |
| 002-base-servidor | Base do servidor | ✅ | — | — | Rascunho |
| 003-tela-revisor | Tela do revisor | ✅ | — | — | Rascunho |
| 004-tela-gerente | ~~Tela do gerente~~ | — | — | — | Cancelada |
| 005-tela-compras | Tela de compras | ✅ | — | — | Rascunho |
| 006-limpeza-virada | Limpeza e virada | ✅ | — | — | Rascunho |

`plan.md` e `tasks.md` das entregas 002–006 são escritos quando a spec estiver **Esclarecida**
(sem `[PRECISA ESCLARECER]`), usando os modelos em `../.specify/templates/`.

Nada desta pasta é enviado ao Google Apps Script (ver `../.claspignore`).
