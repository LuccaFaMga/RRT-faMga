# Constituição do RRT Tecidos

**Versão:** 1.1.0 · **Ratificada em:** 2026-09-25 · **Última alteração:** 2026-09-25 · **Dono:** Lucca

Estes princípios valem para toda spec, plano e linha de código. Um plano que viole um artigo precisa
declarar a exceção na seção *Portão da Constituição* com justificativa e aprovação do dono.

---

## Artigo I — Só o problema entra

O sistema existe para auditar **tecidos com problema**. Toda funcionalidade deve servir a um destes dois
trabalhos: (1) o revisor registrar o problema com evidência, (2) compras cobrar o fornecedor com o PDF.
O caminho é o mais curto possível: o que o revisor conclui vai direto a compras. O que não serve a nenhum
desses trabalhos fica fora (etapas de aprovação intermediárias, controle de estoque, BI, cadastros).

## Artigo II — O celular do revisor é o cliente mais fraco

Toda tela usada no chão do estoque é projetada para um Samsung Galaxy de entrada, em 4G, com uma mão.

- A tela do revisor carrega **< 60 KB** de JavaScript próprio e abre em **< 3 s**.
- Botões com no mínimo 48 px de altura; nada depende de gesto fino.
- Nenhuma ação do revisor perde dados se a página recarregar (rascunho local).

## Artigo III — Coesão por área de negócio

O código é organizado por **área** (Revisão, Compras), não por tipo de arquivo. Cada área tem um
arquivo no servidor e uma pasta de tela. Uma área **nunca** chama outra diretamente; elas se comunicam pelo
`Fluxo` (mudança de estado do rolo).

## Artigo IV — Infraestrutura burra, domínio puro

- `infra/` (Planilha, Arquivos, Pdf, Email) não conhece regras de negócio.
- `dominio/` (Fluxo, Pontuacao, Etiqueta) não chama APIs do Google e é 100% testável em Node.
- `areas/` orquestram: leem com a infra, decidem com o domínio, gravam com a infra.

## Artigo V — Um único caminho de entrada

O cliente fala com o servidor apenas por `api(acao, dados)`. Toda ação está listada em
`specs/000-refatoracao/contracts/api.md`. Ação não listada não existe.

## Artigo VI — Nada solto no global

Apenas `doGet`, `api` e `include` são funções globais. Todo o resto vive em namespaces. Nomes duplicados
são defeito crítico.

## Artigo VII — Teste antes de mudar regra

Regras de negócio (pontuação, limites, transições, interpretação do QR) só mudam com teste escrito antes.
Regras herdadas do legado ganham **teste de caracterização** antes de serem movidas.

## Artigo VIII — Segurança por padrão

- Segredos, IDs e e-mails só em Script Properties.
- Fotos e PDFs não são compartilhados publicamente por link.
- O app exige estar logado em uma conta Google (sem acesso anônimo) a partir da Fase 6. Não há perfis:
  qualquer conta logada acessa tudo.
- Cada mudança de estado registra quem fez (nome informado na tela) e quando (aba HISTORICO).

## Artigo IX — Simplicidade mensurável

Cada entrega deve **reduzir** o número total de linhas do projeto ou justificar o aumento. Abstrações só
entram quando há pelo menos dois usos reais. Sem frameworks no cliente.

## Artigo X — Produção nunca para

A refatoração acontece com o legado no ar. Código novo roda primeiro na implantação de teste com a planilha
de teste. A troca em produção é feita pelo dono, tela por tela, com a versão anterior guardada.

---

## Governança

- Alterar esta constituição exige pedido explícito do dono, novo número de versão (semver) e registro
  abaixo.
- Revisão de conformidade: o `plan.md` de cada entrega preenche o *Portão da Constituição*.

| Versão | Data | Mudança |
|---|---|---|
| 1.0.0 | 2026-09-25 | Versão inicial |
| 1.1.0 | 2026-09-25 | Art. I: dois trabalhos (sem gerente). Art. III: áreas Revisão e Compras. Art. VIII: sem perfis, identificação por nome. Derivado das respostas do dono em `specs/000-refatoracao/spec.md` |
