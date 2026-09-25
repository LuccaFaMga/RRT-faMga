# Especificação: Base do servidor

**Pasta:** `specs/002-base-servidor` · **Status:** Rascunho (rev. 2 — sem gerente) · **Criada em:** 2026-09-25 · **Depende de:** Fase 0
**Detalha:** `specs/000-refatoracao/spec.md` → RF-005, RF-006, RF-007, RF-009, RF-011, RNF-005, H4

## Contexto

O servidor atual tem duas camadas de planilha (`DatabaseService`, `SheetsService`), duas implementações de
PDF e de upload de foto, 13 funções globais duplicadas e um fluxo de 11 estados que grava cada transição
em 3–4 abas. Qualquer mudança exige mexer em vários arquivos e o risco de quebrar outra tela é alto.

Esta entrega cria a base sobre a qual as telas 003–005 são construídas. Ela não muda nada que o usuário vê.

## Histórias de usuário

### H1 — Regras confiáveis (P1)

**Como** compras, **quero** que a pontuação e os limites no PDF sejam os mesmos de hoje, **para** não mudar
o critério apresentado ao fornecedor sem perceber.

**Cenários de aceite:**
1. **Dado** os 5 rolos reais com medidas conferidas (Fase 0), **quando** a pontuação é calculada pelo novo
   código, **então** o resultado é igual ao confirmado pelo responsável pela revisão.
2. **Dado** uma divergência entre legado e valor confirmado, **então** vale o valor confirmado e a
   divergência fica registrada em *Esclarecimentos*.
3. **Dado** qualquer pontuação, **então** ela não decide o destino do rolo (não há mais aprovação automática).

### H2 — Fluxo com regras claras (P1)

**Como** compras, **quero** que um rolo só mude de estado pelos caminhos permitidos.

**Cenários de aceite:**
1. **Dado** um rolo em `LIBERADO`, **quando** alguém tenta devolvê-lo, **então** a ação é recusada com
   mensagem clara.
2. **Dado** um rolo em estado do legado (ex.: `aguardando_supervisor`), **quando** é lido, **então** é
   tratado como o estado novo equivalente.

### H3 — Histórico único (P2)

**Como** responsável pelo processo, **quero** ver em um lugar quem mudou cada rolo e quando.

**Cenários de aceite:**
1. **Dado** qualquer mudança de estado feita pelo código novo, **então** existe uma linha em HISTORICO com
   de, para, quem, quando e observação.

### H4 — Configuração segura (P1)

**Como** dono do sistema, **quero** que IDs, e-mails e segredos fiquem fora do código.

**Cenários de aceite:**
1. **Dado** o projeto, **quando** busco por IDs de planilha, pastas ou e-mails, **então** eles não aparecem
   no código novo.
2. **Dado** uma propriedade obrigatória ausente, **então** a primeira ação falha com mensagem dizendo qual
   propriedade falta.

## Casos de borda

- Duas gravações simultâneas no mesmo rolo → uma espera a outra (lock), nenhuma perde dados.
- Aba sem uma coluna esperada → erro claro com o nome da coluna, sem gravar parcialmente.
- Arquivo de foto apagado no Drive → detalhe do rolo continua abrindo, com a foto marcada como indisponível.

## Requisitos funcionais

- **RF-001**: Ler e gravar as abas de `data-model.md` por nome de coluna, não por posição.
- **RF-002**: Ler cada aba no máximo uma vez por execução.
- **RF-003**: Validar transições pela tabela de `data-model.md` e converter estados do legado.
- **RF-004**: Gravar cada transição em HISTORICO; parar de gravar em AUDIT, TELEMETRIA e TEMPOS_LOG
  **a partir do código novo**.
- **RF-005**: Calcular pontuação conforme *Regras de negócio herdadas*.
- **RF-006**: Criar a pasta do rolo e salvar fotos sem compartilhamento público.
- **RF-007**: Montar o HTML do relatório do rolo (`Relatorio`, puro) e convertê-lo em PDF salvo na pasta do rolo.
- **RF-008**: Enviar e-mail com ou sem anexo.
- **RF-009**: Expor o ponto de entrada único `api(acao, dados)` com a tabela de ações (inicialmente vazia
  ou só com ações de diagnóstico).
- **RF-010**: Manter as telas antigas funcionando por meio de adaptadores de uma linha.
- **RF-011**: Continuar o contador `REVISION_COUNTER_AAAA` no formato atual.
- **RF-012**: Exigir `responsavel` não vazio em toda ação que grava.

## Requisitos não funcionais

- **RNF-001**: Domínio (`Fluxo`, `Pontuacao`, `Etiqueta`) com 100% das regras cobertas por testes Node.
- **RNF-002**: Nenhuma função global nova além de `doGet`, `api`, `include`.
- **RNF-003**: Leitura de configuração uma única vez por execução.

## Fora do escopo

- Qualquer mudança visual.
- Migração dos dados antigos (fica na 006).

## Critérios de sucesso

- **CS-001**: `npm test` verde com testes de Fluxo, Pontuacao, Etiqueta, Planilha (com dublê).
- **CS-002**: Na implantação de teste, um rolo percorre o fluxo inteiro pelas telas antigas usando o código
  novo por baixo.
- **CS-003**: `DatabaseService.js`, `SheetsService.js`, `CoreService.js`, `DocumentService.js`,
  `WorkflowService.js`, `ValidationService.js` e `routers/` removidos ou reduzidos a adaptadores.

## Esclarecimentos

| Data | Pergunta | Resposta |
|---|---|---|
| — | Unidades de largura e metragem na etiqueta e fórmula (ver `data-model.md` → Unidades) | [PRECISA ESCLARECER] |
| — | O layout do PDF atual (modelo no Google Docs) deve ser reproduzido fielmente ou pode ser redesenhado? | [PRECISA ESCLARECER] |

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação além dos contratos já definidos em 000
- [x] Requisitos testáveis
- [x] Critérios mensuráveis
- [ ] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
