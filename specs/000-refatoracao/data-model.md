# Modelo de dados: RRT Tecidos

**Referência de:** `specs/000-refatoracao/plan.md` · **Atualizado em:** 2026-09-25 (rev. 2 — sem etapa de gerente, sem perfis)

A planilha continua a mesma (ID em Script Properties `SHEET_ID`). Abas existentes são reaproveitadas.
Colunas novas são **adicionadas ao final**; nenhuma coluna existente é apagada durante a refatoração.

> **Tarefa obrigatória da Fase 0:** exportar a linha de cabeçalho real de cada aba para
> `specs/000-refatoracao/cabecalhos-atuais.md`. As colunas abaixo usam os nomes-alvo; onde a aba já tiver
> uma coluna equivalente com outro nome, **mantenha o nome existente** e registre o mapeamento aqui.

## Abas

### INSPECOES — um registro por rolo com problema

| Coluna | Tipo | Origem | Observação |
|---|---|---|---|
| REVISION_ID | texto | sistema | `REV-NNNN-AAAA`, chave primária |
| ID_ROLO | texto | etiqueta/sistema | identificador do rolo — **não é único**: um rolo relido gera nova revisão |
| ESTADO | texto | Fluxo | um dos 6 estados abaixo |
| FORNECEDOR_ID | texto | etiqueta `supplier_id` | |
| FORNECEDOR | texto | etiqueta `supplier_nm` | |
| NF | texto | etiqueta `nf` | |
| PRODUTO_ID | texto | etiqueta `product_id` | |
| PRODUTO_FORNECEDOR | texto | etiqueta `sup_product_id` | |
| LOTE | texto | etiqueta `lot` | |
| COR | texto | etiqueta `color_id` | |
| PADRONAGEM | texto | etiqueta `fabric_pattern` | |
| LOCALIZACAO | texto | etiqueta `loc` | |
| COMPOSICAO | texto | etiqueta `comp` | |
| TIPO_TECIDO | texto | revisor | `PLANO` ou `MALHA` |
| METROS_FORNECEDOR | número | etiqueta | ver *Unidades* |
| METROS_REVISADO | número | revisor | |
| LARGURA_CM | número | etiqueta/revisor | ver *Unidades* |
| PESO_KG | número | revisor | obrigatório para MALHA |
| PONTOS | número | Pontuacao | soma dos pontos dos defeitos |
| PONTOS_REFERENCIA | número | Pontuacao | pts/100 m² (PLANO) ou pts/100 kg (MALHA) |
| LIMITE_REFERENCIA | número | Pontuacao | 35 (PLANO) ou 30 (MALHA) |
| REVISOR | texto | tela | nome informado pelo revisor (lembrado no aparelho) |
| OBS_REVISOR | texto | revisor | |
| OBS_COMPRAS | texto | compras | texto livre que vai ao PDF |
| RESULTADO_FORNECEDOR | texto | compras | `ACEITO`, `ABATIMENTO`, `DEVOLUCAO` |
| PASTA_ID | texto | Arquivos | pasta do rolo no Drive |
| PDF_ID | texto | Pdf | último PDF gerado |
| PDF_GERADO_EM | data ISO | Pdf | |
| EMAIL_COMPRAS_EM | data ISO | Email | quando o aviso foi enviado (vazio = falhou) |
| CRIADO_EM | data ISO | sistema | |
| ATUALIZADO_EM | data ISO | sistema | |

### DEFEITOS — N por rolo

| Coluna | Tipo | Observação |
|---|---|---|
| DEFEITO_ID | texto | `REVISION_ID-NN` |
| REVISION_ID | texto | FK para INSPECOES |
| TIPO | texto | lista fechada — ver *Listas* abaixo |
| METRO_INICIAL | número | |
| METRO_FINAL | número | ≥ METRO_INICIAL |
| GRAVIDADE | número | 1 a 4 (ver *Regras*) |
| ZONA | texto | zonas na largura separadas por vírgula (ex.: `A,C`) — ver *Listas* |
| OBSERVACAO | texto | |
| CRIADO_EM | data ISO | |

### FOTOS — N por rolo

| Coluna | Tipo | Observação |
|---|---|---|
| FOTO_ID | texto | ID do arquivo no Drive |
| REVISION_ID | texto | FK |
| DEFEITO_ID | texto | vazio = foto geral |
| TIPO | texto | `GERAL`, `DEFEITO`, `ETIQUETA` |
| NOME | texto | nome do arquivo |
| CRIADO_EM | data ISO | |

Sem coluna de URL pública: a tela obtém a imagem via `api('...foto', {fotoId})`.

### HISTORICO — um registro por mudança de estado

| Coluna | Tipo | Observação |
|---|---|---|
| EVENTO_ID | texto | UUID |
| REVISION_ID | texto | FK |
| DE | texto | estado anterior (vazio na criação) |
| PARA | texto | estado novo |
| QUEM | texto | nome informado na tela (ou `sistema`) |
| QUANDO | data ISO | |
| OBSERVACAO | texto | |

### Abas congeladas

`AUDIT`, `TELEMETRIA`, `TEMPOS_LOG`: deixam de receber dados na entrega 002. Continuam na planilha para
consulta. Remoção decidida pelo dono após a 006.

## Estados do rolo

| Estado | Significado | Quem move para cá |
|---|---|---|
| `EM_REVISAO` | revisor está registrando | Revisao.iniciar |
| `EM_COMPRAS` | revisão concluída; PDF enviado a compras, que negocia com o fornecedor | Revisao.concluir |
| `LIBERADO` | fornecedor aceitou ou deu abatimento; rolo pode ser usado | Compras.registrarRetorno |
| `DEVOLVIDO` | rolo devolvido ao fornecedor | Compras.registrarRetorno |
| `CANCELADO` | revisão aberta por engano | Revisao.cancelar (só em `EM_REVISAO`) |

### Transições permitidas

```
(novo)       → EM_REVISAO
EM_REVISAO   → EM_COMPRAS | CANCELADO
EM_COMPRAS   → LIBERADO | DEVOLVIDO
LIBERADO     → (fim)
DEVOLVIDO    → (fim)
CANCELADO    → (fim)
```

A pontuação **não** altera o caminho: todo rolo concluído vai para `EM_COMPRAS`.

### Conversão dos estados do legado

| Legado | Novo | Observação |
|---|---|---|
| `criado`, `em_revisao` | `EM_REVISAO` | |
| `aguardando_supervisor` | `EM_COMPRAS` | não há mais etapa de gerente; na migração, gerar PDF se não existir |
| `reprovado_supervisor`, `enviado_compras` | `EM_COMPRAS` | |
| `aprovado_revisor`, `aprovado_supervisor`, `aprovado_compras`, `em_estoque`, `estoque_zerado` | `LIBERADO` | |
| `reprovado_compras`, `finalizado_reprovado` | `DEVOLVIDO` | |

## Regras de negócio herdadas (manter e cobrir com testes de caracterização)

Fonte: `services/CoreService.js`, `core/ArithmeticUtils.js`, `App/App.js#calculateScoreAndDecision`.

1. **Gravidade → pontos:** número 1–4 é usado direto; texto é mapeado (`LEVE`/`PEQUENO`=1,
   `MEDIA`/`MÉDIA`/`MEDIO`/`MÉDIO`=2, `GRAVE`/`GRANDE`=3, demais conforme `MAPA_GRAVIDADE_TEXTO`).
   Máximo de 4 pontos por defeito.
2. **Pontos por 100 m² (PLANO):** `pontos × 100 / (comprimento_m × largura)`, arredondado com 3 casas
   (`roundABNT`). Limite de referência: **35**.
3. **Pontos por 100 kg (MALHA):** conforme `calcularPontuacaoPorTipo`. Limite de referência: **30**.
4. **Furos:** máximo 6 por 100 m (PLANO) ou 6 por 20 kg (MALHA), proporcional à metragem/peso.
5. **Pontos por metro linear:** máximo 4 em qualquer metro.
6. **Cálculo insuficiente** (sem metragem/largura/peso) → não bloqueia; o rolo segue a compras com o aviso no PDF.
7. **Removida:** aprovação automática com pontuação abaixo do limite (`calculateScoreAndDecision`). O limite
   passa a ser só referência no PDF.

## Listas

Levantadas do legado em 2026-09-25. O legado tem **duas** listas de tipo de defeito diferentes
(`ui/reviewer.html` e o modal de `ui/reviewer_core_js.html`). A lista adotada é a do formulário principal;
confirmar na entrega 003 (`specs/003-tela-revisor/spec.md` → Esclarecimentos).

**Tipo de defeito (adotada):**

| Código | Rótulo |
|---|---|
| `dirty_stain` | Sujeira / Manchas (óleo, fiapos, mancha) |
| `physical_damage` | Danos físicos (furo, rasgo, fio puxado) |
| `appearance_shade` | Aparência / Tom (tonalidade, vinco) |
| `print_pattern` | Estampa / Padronagem (desenho, listra torta) |
| `structural_selvage` | Estrutural (ourela torta, emendas) |
| `__outro__` | Outro (texto livre) |

Lista do modal (não adotada): `appearance_shade` Diferença de matiz, `physical_damage` Dano físico,
`hole` Furo, `stain` Mancha, `crease` Dobra, `thickness` Espessura, `__outro__`.

**Zona na largura:** `A` borda esquerda, `B`, `C` centro, `D`, `E` borda direita.

**Gravidade (pontos):** `1` leve (até ~7,5 cm), `2` média (7,5–15 cm), `3` grave (15–23 cm), `4` crítica
(acima de ~23 cm), `4_furo` furo maior que 1,5 cm (4 pontos, conta para o limite de furos).

**Revisores:** o legado tem 3 nomes fixos no HTML. No novo código a lista fica na Script Property
`REVISORES` (nomes separados por `;`), e a tela oferece essa lista + "Outro nome".

### Unidades — [PRECISA ESCLARECER]

O legado tem inconsistências que precisam ser resolvidas **com etiquetas reais** antes de mover a regra:

- `normalizeQrPayload` grava `wid ← meters_supplier` e o formato posicional lê `len = parts[9]`,
  `wid = parts[10]`; `buildStructuredPayload` então faz `len → largura_cm` e `wid → metros_fornecedor`.
  Ou seja, os nomes `len`/`wid` estão trocados em relação ao significado.
- O comentário de `CoreService.calculatePointsPer100m2` fala em `× 1.000`, o código usa `× 100`.
- O exemplo em `ArithmeticUtils` (`calculatePointsPer100m2(5, 1.55, 24.1)`) passa a largura em metros no
  parâmetro chamado `larguraCm`.

Ação: na entrega 002, coletar 5 etiquetas reais com as medidas conferidas à mão e escrever os testes com o
resultado esperado confirmado pelo responsável pela revisão.

## Numeração de revisão

`REV-NN-AAAA` com contador anual em Script Properties (`REVISION_COUNTER_AAAA`), incrementado sob
`LockService`. **Decidido em 2026-09-25:** continuar do contador atual e manter o formato atual
(`padStart(2)`, ex.: `REV-40-2026`, `REV-100-2026`). O novo código lê e grava a mesma propriedade.

## Arquivos no Drive

```
<OUTPUT_FOLDER_ID>/
  AAAA/
    REV-NNNN-AAAA/
      fotos/   <FOTO_ID>.jpg
      REV-NNNN-AAAA.pdf
```
Compartilhamento: herdado da pasta raiz (restrito à organização / pessoas com acesso). Nunca público.
