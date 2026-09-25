# Especificação: Refatoração do RRT Tecidos

**Pasta:** `specs/000-refatoracao` · **Status:** Esclarecida · **Criada em:** 2026-09-25 · **Revisada em:** 2026-09-25 · **Depende de:** —

Esta é a especificação-mãe. Ela define o resultado da refatoração inteira. Cada entrega
(`001` a `006`) tem sua própria spec, que detalha uma parte desta.

> **Revisão 2026-09-25:** a etapa do gerente foi removida. O rolo revisado vai direto para compras com o
> PDF. Não há perfis nem login próprio: qualquer conta Google acessa. Ver *Esclarecimentos*.

## Contexto

O RRT é usado para auditar rolos de tecido com problema. Hoje:

- A tela do revisor carrega cerca de **780 KB** de JavaScript (duas bibliotecas de QR, scanner de 2.677
  linhas, núcleo de 3.100 linhas, service worker e gerenciador offline).
- A leitura do QR no Samsung **demora ou não acontece**. A etiqueta tem 12+ campos (fornecedor, NF, produto,
  lote, cor, padronagem, localização, medidas, composição) num QR de cerca de 1 cm, e o scanner processa até
  8 variações reduzidas de cada frame em vez de usar resolução.
- O servidor tem **5 funções globais definidas duas vezes** (ex.: `processSupervisorDecision` em `App.js` e
  em `SupervisorRouter.js`, com comportamentos diferentes; `insertStructuredData` duas vezes no mesmo
  arquivo), além de duas camadas de
  acesso à planilha, duas implementações de PDF e de upload de foto.
- O fluxo tem **11 estados** e uma etapa de supervisor que foi pensada para quando **todos** os tecidos eram
  revisados. Hoje só entram tecidos com problema, então essa etapa virou atraso.
- `SECRET_KEY` tem como padrão um UUID novo por execução, o que invalida os links assinados enviados ao
  supervisor se a propriedade não estiver definida.
- O app aceita acesso anônimo e as fotos são compartilhadas publicamente por link.
- O projeto tem ~25.800 linhas.

## Perfis

Não há cadastro de usuários nem perfis. Qualquer pessoa com uma conta Google acessa o app. As telas são
separadas por uso, não por permissão.

| Uso | Onde | Trabalho |
|---|---|---|
| Revisão | Samsung, Chrome, 4G/Wi-Fi do estoque | Registrar rolo com problema: etiqueta, defeitos, fotos |
| Compras | Computador (ou celular) | Receber o PDF, analisar o rolo, cobrar o fornecedor e registrar o retorno |

## Histórias de usuário

### H1 — Ler a etiqueta sem esperar (P1)

**Como** revisor, **quero** que a etiqueta seja lida em poucos segundos, **para** não travar a revisão.

**Cenários de aceite:**
1. **Dado** um rolo com etiqueta legível, **quando** aponto a câmera, **então** os dados aparecem em ≤ 3 s.
2. **Dado** que a leitura ao vivo não funcionou em 4 s, **quando** toco em "Fotografar etiqueta", **então**
   posso tirar uma foto e os dados são lidos a partir dela.
3. **Dado** uma etiqueta danificada, **quando** escolho "Digitar", **então** informo NF, produto e lote
   manualmente e sigo a revisão.

### H2 — Registrar o problema com evidência (P1)

**Como** revisor, **quero** registrar defeitos e fotos de um rolo, **para** que compras tenha tudo para
cobrar o fornecedor sem ir até o rolo.

**Cenários de aceite:**
1. **Dado** a etiqueta lida, **quando** adiciono defeitos (tipo, metro inicial/final, gravidade, zona) e
   fotos, **então** vejo a pontuação calculada e posso concluir.
2. **Dado** que a página recarregou no meio da revisão, **quando** abro de novo, **então** a revisão
   continua de onde parou, com as fotos já enviadas.
3. **Dado** que concluí, **então** o PDF do rolo é gerado e compras recebe um e-mail com o PDF anexado e o
   link para o rolo.

### H3 — Compras recebe o caso pronto (P1)

**Como** compras, **quero** receber cada rolo com problema já com o PDF completo, **para** enviar ao
fornecedor sem montar nada.

**Cenários de aceite:**
1. **Dado** uma revisão concluída, **então** o PDF contém: dados da etiqueta, fornecedor, NF, lote, medidas,
   composição, defeitos com metragem, pontuação e limite de referência, fotos e observação do revisor.
2. **Dado** o e-mail, **quando** abro o link, **então** vejo o rolo com defeitos e fotos em tela, podendo
   ampliar as fotos.
3. **Dado** que quero acrescentar um texto meu, **quando** escrevo a observação e gero o PDF de novo,
   **então** o PDF passa a incluir a observação de compras.
4. **Dado** o retorno do fornecedor, **quando** registro "aceito", "abatimento" ou "devolução", **então** o
   rolo é encerrado com esse resultado.

### H4 — Rastreabilidade (P2)

**Como** responsável pelo processo, **quero** saber quem fez cada passo e quando.

**Cenários de aceite:**
1. **Dado** qualquer rolo, **então** existe o histórico completo de mudanças de estado com nome de quem
   fez, data e observação.

## Casos de borda

- Etiqueta em formato desconhecido → oferecer digitação, nunca travar.
- Sem sinal no momento de enviar foto → a foto fica na fila local e reenvia; a revisão não pode ser concluída
  com foto pendente.
- Falha ao gerar o PDF na conclusão → o rolo vai para compras mesmo assim, o e-mail avisa que o PDF falhou e
  compras gera pela tela.
- Rolo que já passou pelo sistema é lido de novo → abre uma **nova revisão** (novo `REV-…`), ligada ao
  mesmo rolo; as anteriores continuam consultáveis.
- Só um revisor usa o app por vez (decidido em 2026-09-25): não há tratamento de concorrência entre
  revisores além do lock de gravação.

## Requisitos funcionais

- **RF-001**: Ler a etiqueta por vídeo, por foto ou por digitação.
- **RF-002**: Interpretar todos os formatos de etiqueta aceitos hoje (JSON, URL com parâmetros,
  chave=valor/chave:valor, posicional com `;` e 12+ campos).
- **RF-003**: Registrar até 30 defeitos por rolo com tipo, metro inicial, metro final, gravidade, zona e
  observação.
- **RF-004**: Registrar fotos gerais e fotos ligadas a defeitos.
- **RF-005**: Calcular a pontuação com as **mesmas regras do legado** (ver `data-model.md`, seção Regras).
  A pontuação é informativa: não decide o destino do rolo.
- **RF-006**: Manter o rolo em um dos estados definidos em `data-model.md`, com transições validadas.
- **RF-007**: Ao concluir a revisão, gerar o PDF e enviar e-mail a compras com o PDF anexado e link direto.
- **RF-008**: Permitir a compras regenerar o PDF com uma observação própria.
- **RF-009**: Registrar cada transição na aba HISTORICO.
- **RF-010**: Identificar quem fez cada ação pelo **nome informado na tela** (lembrado no aparelho), já que
  não há login próprio.
- **RF-011**: Continuar a numeração `REV-NN-AAAA` a partir do contador atual.

## Requisitos não funcionais

- **RNF-001**: Tela do revisor com < 60 KB de JS próprio e abertura < 3 s em 4G num Galaxy de entrada.
- **RNF-002**: Leitura de etiqueta ≤ 3 s em 20 de 20 etiquetas reais (vídeo ou foto).
- **RNF-003**: Foto enviada com ~250 KB (lado maior 1600 px, JPEG qualidade 0,75).
- **RNF-004**: Conclusão da revisão (gravação + PDF + e-mail) em ≤ 20 s.
- **RNF-005**: Nenhum ID, e-mail ou segredo no código; nenhum arquivo público por link.
- **RNF-006**: Acesso exige estar logado em uma conta Google (sem acesso anônimo).
- **RNF-007**: Projeto final com 4.000–6.000 linhas e apenas 3 funções globais.

## Entidades

- **Rolo**: um rolo com problema; dados da etiqueta, medidas, tipo de tecido, estado atual.
- **Defeito**: ocorrência em um trecho do rolo.
- **Foto**: imagem ligada ao rolo e, opcionalmente, a um defeito.
- **Evento**: mudança de estado (de, para, quem, quando, observação).

## Fora do escopo

- Etapa de análise/aprovação pelo gerente ou supervisor (decidido em 2026-09-25).
- Aprovação automática por pontuação.
- Cadastro de usuários, perfis e permissões.
- Controle de estoque (retiradas, solicitações de corte, estoque zerado) — removido (decidido em 2026-09-25).
- Power BI, exportação, rota `kpi_data` e dashboard de KPIs — removidos (decidido em 2026-09-25).
- Aprovação via Google Forms.
- Funcionamento offline e instalação como app (PWA).
- Registro de tecidos sem problema.

## Critérios de sucesso

- **CS-001**: 20 de 20 etiquetas reais lidas em ≤ 3 s no Samsung da operação.
- **CS-002**: Revisão com 5 fotos concluída em < 3 min.
- **CS-003**: Compras recebe o e-mail com PDF em até 1 min após a conclusão da revisão.
- **CS-004**: Compras envia o PDF ao fornecedor sem editar.
- **CS-005**: Nenhuma revisão perdida durante 2 semanas de uso após a virada.
- **CS-006**: Projeto com ≤ 6.000 linhas.

## Esclarecimentos

| Data | Pergunta                                                                                                             | Resposta                                                                                                                                                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | Todo rolo registrado vai ao gerente, mesmo com pontuação abaixo do limite? (Hoje há aprovação automática < 35) | o projeto principal era pra revisao de todos os tecidos, entao quando revisasse um tecido e ele passase ia para o gestor. mas agora como só vao ser revisados os tecidos com problema. essa regra nao faz mais sentido. todos vao para o gestor. podemos até ignorar o gestor. podemos otimizar o processo. ja vai direto para o setor de compras com o pdf. |
| 2026-09-25 | Quem são os usuários de cada perfil e como o sistema sabe o perfil de cada conta?                                  | só tem uma conta, nao tem login, é só alguem entrar com alguma conta do google que ja vai ter acesso.                                                                                                                                                                                                                                                       |
| 2026-09-25 | A contagem de revisões`REV-NN-AAAA` deve continuar do número atual?                                              | pode continuar.                                                                                                                                                                                                                                                                                                                                                |


### Decisões derivadas (2026-09-25)

- **Sem etapa de gerente:** estado `AGUARDANDO_GERENTE` e a entrega `004-tela-gerente` cancelados. A tela de
  análise (detalhe + galeria) passa para a tela de compras (`005`).
- **Todo rolo concluído vai para compras**, independentemente da pontuação.
- **Sem perfis:** o app usa acesso "qualquer pessoa com conta Google" e roda como o dono da implantação. Como
  o Apps Script não informa o e-mail de contas de fora do domínio nesse modo, o nome de quem faz a ação é
  digitado uma vez e lembrado no aparelho.
- **Numeração:** continua do contador atual (`REVISION_COUNTER_AAAA`), no formato atual.

### Segunda rodada (2026-09-25)

| Pergunta | Resposta |
|---|---|
| Dois revisores abrem o mesmo rolo: bloquear o segundo ou permitir e avisar? | só um revisor vai usar por vez, nao temos esse problema. |
| Rolo lido de novo: abrir o existente ou criar nova revisão? | se um rolo que ja passou, abre uma nova revisao. |
| Controle de estoque sai do app? | o controle de estoque pode sair. |
| KPIs/Power BI: Power BI passa a ler a planilha direto? | nesse projeto nao vamos usar powerbi. |
| Para quais e-mails de compras vai o aviso? | quando o projeto estiver concluido vou adicionar o email correto do compras na config, por enquanto vou usar o meu. |

Consequências:
- `revisao.retomar` devolve a revisão `EM_REVISAO` aberta (há no máximo uma), sem filtrar por nome.
- `ID_ROLO` deixa de ser único em INSPECOES; a chave é `REVISION_ID`.
- Saem do projeto: `EstoqueController`, `EstoqueService`, `EstoqueRouter`, retiradas, solicitações de corte,
  `getKPIDashboardData`, `handlePowerBIExport`, métricas de revisores e as rotas `kpi_data`/`export`.
- `EMAIL_COMPRAS` fica nas Script Properties com o e-mail do dono durante o desenvolvimento; trocar pelo
  e-mail de compras na virada (tarefa na 006). Nenhum e-mail no código.

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação (ficam em `plan.md`)
- [x] Requisitos testáveis
- [x] Critérios de sucesso mensuráveis
- [x] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
