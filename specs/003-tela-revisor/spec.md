# Especificação: Tela do revisor

**Pasta:** `specs/003-tela-revisor` · **Status:** Rascunho (rev. 2 — conclui direto para compras) · **Criada em:** 2026-09-25 · **Depende de:** 001, 002
**Detalha:** `specs/000-refatoracao/spec.md` → H1, H2, RF-003, RF-004, RF-007, RF-010, RNF-001, RNF-003, RNF-004

## Contexto

A tela atual do revisor soma ~780 KB de JavaScript, envia fotos de até 40 MB no final da revisão e tem 4
seções longas numa página só. Se a conexão cai no envio final, a revisão inteira pode se perder.

## Histórias de usuário

### H1 — Revisão em três passos (P1)

**Como** revisor, **quero** um caminho curto — etiqueta → problemas → concluir — **para** registrar o rolo
sem me perder na tela.

**Cenários de aceite:**
1. **Dado** que abro o app pela primeira vez no aparelho, **então** informo meu nome uma vez; nas próximas,
   ele aparece no topo com a opção "trocar".
2. **Dado** que abro o app, **então** vejo o leitor da etiqueta (passo 1).
3. **Dado** a etiqueta lida, **quando** confiro os dados e escolho o tipo de tecido (plano/malha),
   **então** vou ao passo 2.
4. **Dado** o passo 2, **quando** adiciono defeitos e fotos, **então** vejo a pontuação atualizada a cada
   defeito.
5. **Dado** o passo 3, **quando** informo metros revisados, largura (e peso, se malha) e toco em
   "Enviar para compras", **então** vejo o progresso ("Salvando… Gerando PDF… Avisando compras…") e, ao
   final, a confirmação com o número da revisão.
6. **Dado** que o PDF falhou, **então** a confirmação diz "Enviado para compras. O PDF não foi gerado;
   compras vai gerar pela tela." e a revisão não se perde.

### H2 — Fotos que não se perdem (P1)

**Como** revisor, **quero** que cada foto seja enviada assim que eu a tiro, **para** não perder o trabalho.

**Cenários de aceite:**
1. **Dado** que tiro uma foto, **então** ela aparece como miniatura com indicador "enviando" e depois
   "enviada".
2. **Dado** que o envio falha, **então** a miniatura mostra "tentar de novo" e o botão de concluir fica
   bloqueado até todas estarem enviadas.
3. **Dado** que tiro uma foto de 8 MB, **então** o envio tem cerca de 250 KB.

### H3 — Retomar (P1)

**Como** revisor, **quero** voltar para a revisão que estava fazendo se a página fechar.

**Cenários de aceite:**
1. **Dado** uma revisão em andamento, **quando** abro o app, **então** vejo "Continuar REV-…" com os
   dados, defeitos e fotos já registrados.

### H4 — Cancelar (P2)

**Cenários de aceite:**
1. **Dado** uma revisão aberta por engano, **quando** cancelo com um motivo, **então** ela sai da minha tela
   e não vai a compras.

## Casos de borda

- Etiqueta de um rolo que já tem revisão anterior → cria nova revisão e mostra "Este rolo já foi revisado
  em DD/MM (REV-…)" apenas como informação.
- Defeito com metro final menor que o inicial → não aceita, explica.
- 30 defeitos atingidos → aviso e bloqueio de novos.
- Malha sem peso → pontuação mostrada como "cálculo incompleto", mas o envio é permitido.
- Tela girada, teclado aberto sobre o botão → botões principais fixos no rodapé visível.

## Requisitos funcionais

- **RF-001**: Três passos com indicação de progresso.
- **RF-002**: Defeito: tipo (lista), metro inicial, metro final, gravidade 1–4, zona(s) na largura,
  observação, foto opcional.
- **RF-003**: Foto reduzida no aparelho antes do envio e enviada individualmente.
- **RF-004**: Rascunho local de etiqueta, medidas e defeitos, apagado após concluir.
- **RF-005**: Pontuação calculada no aparelho (mesma regra do servidor) e confirmada pelo servidor ao
  concluir.
- **RF-006**: Nome do responsável obrigatório, escolhido uma vez numa lista (Script Property `REVISORES`)
  ou digitado em "Outro nome", e guardado no aparelho.

## Requisitos não funcionais

- **RNF-001**: < 60 KB de JavaScript próprio na página; abertura < 3 s em 4G.
- **RNF-002**: Alvos de toque ≥ 48 px; contraste AA; funciona com uma mão.

## Fora do escopo

- Histórico de revisões do próprio revisor e métricas.

## Critérios de sucesso

- **CS-001**: Revisão com 5 fotos em < 3 min no Samsung.
- **CS-002**: Zero revisões perdidas em teste de "fechar a página no meio" (10 tentativas).
- **CS-003**: Conclusão (gravação + PDF + e-mail) em ≤ 20 s.

## Esclarecimentos

| Data | Pergunta | Resposta |
|---|---|---|
| — | Confirmar a lista de tipos de defeito adotada em `data-model.md` → Listas (há duas listas diferentes no legado) | [PRECISA ESCLARECER] |
| — | Foto da etiqueta deve ser guardada sempre? | [PRECISA ESCLARECER — sugestão: sim, quando a leitura foi por foto] |
| — | Número mínimo de fotos para concluir? | [PRECISA ESCLARECER — sugestão: 1] |

## Checklist de qualidade da spec

- [x] Sem detalhes de implementação
- [x] Requisitos testáveis
- [x] Critérios mensuráveis
- [ ] Nenhum `[PRECISA ESCLARECER]` aberto
- [x] Escopo delimitado
