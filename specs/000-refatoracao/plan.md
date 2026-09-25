# Plano técnico: Refatoração do RRT Tecidos

**Spec:** `specs/000-refatoracao/spec.md` · **Status:** Rascunho · **Data:** 2026-09-25 · **Revisão:** 2 (sem gerente, sem perfis)

## Resumo

Manter o Google Apps Script e reescrever o sistema em camadas por área de negócio, trocando uma parte por vez
enquanto o legado continua no ar. O cliente passa a usar o detector de QR nativo do Chrome com recorte em
resolução cheia e fallback por foto. O servidor ganha um único ponto de entrada (`api`), uma camada de
infraestrutura única (Planilha, Arquivos, Pdf, Email) e um domínio puro testável em Node (Fluxo, Pontuacao,
Etiqueta). O processo encurta: o revisor conclui e o rolo vai direto a compras com o PDF, sem etapa de
gerente e sem perfis de acesso.

## Decisão de plataforma

| Opção | Prós | Contras | Decisão |
|---|---|---|---|
| Otimizar no GAS | Sheets/Drive/PDF/e-mail grátis e já integrados; sem infraestrutura nova | Chamadas lentas (1–3 s), iframe, sem offline | **Escolhida** |
| Tela fora (Firebase/GitHub Pages) + GAS como API | PWA real, offline, câmera sem iframe | CORS, autenticação, dois deploys | Reavaliar se offline virar requisito |
| Sair do GAS (Node/Supabase etc.) | Controle total, escala | Refazer PDF, e-mail, auth, hospedagem, custo | Descartada agora |

**Gatilhos para reavaliar:** offline obrigatório; INSPECOES > 30 mil linhas; login por pessoa com permissões
finas.

## Contexto técnico

- **Plataforma:** Google Apps Script V8, HtmlService (modo IFRAME), `clasp` com `rootDir` na raiz
- **Cliente:** Chrome Android (Samsung Galaxy). `BarcodeDetector` nativo; jsQR só como fallback
- **Armazenamento:** Google Sheets (mesma planilha, abas existentes) + Drive (uma pasta por rolo)
- **Testes:** Node 22+ `npm test`, com dublês de `SpreadsheetApp`, `DriveApp`, `LockService`
- **Ambientes:** dois **projetos** Apps Script. As Script Properties são do projeto, não da implantação, então
  uma segunda implantação do mesmo projeto usaria a mesma planilha. O projeto **teste** é uma cópia com
  `scriptId` próprio (`.clasp.teste.json`) e Properties apontando para a planilha/pasta de teste; o projeto
  **produção** é o atual (`.clasp.json`).

## Portão da Constituição

| Artigo | Atende? | Observação |
|---|---|---|
| I — Só o problema entra | ✅ | Etapa de gerente, controle de estoque, Power BI/KPIs e Forms removidos |
| II — Celular mais fraco | ✅ | Meta < 60 KB JS; zxing, SW e offline removidos |
| III — Coesão por área | ✅ | `areas/Revisao`, `areas/Compras` |
| IV — Infra burra, domínio puro | ✅ | `infra/` e `dominio/` separados |
| V — Um caminho de entrada | ✅ | `api(acao, dados)` + tabela `ACOES` |
| VI — Nada no global | ✅ | Exceção temporária: adaptadores do legado até a Fase 6 |
| VII — Teste antes de regra | ✅ | Testes de caracterização de Pontuacao e Etiqueta na 002 |
| VIII — Segurança | ✅ | Properties, sem link público, conta Google obrigatória na 006; sem perfis (decisão do dono) |
| IX — Simplicidade | ✅ | ~25.800 → 4.000–6.000 linhas |
| X — Produção nunca para | ✅ | Adaptadores + projeto de teste separado + virada por tela |

## Arquitetura alvo

```
src/
  server/
    main.js            doGet(e) + api(acao, dados) + include(nome)
    config.js          Config: lê Script Properties uma vez e congela
    infra/
      Planilha.js      Planilha.ler(aba) / .inserir(aba, linhas) / .atualizar(aba, chave, patch)
      Arquivos.js      Arquivos.pastaDoRolo(id) / .salvarFoto(id, base64, nome) / .miniatura(fileId)
      Pdf.js           Pdf.deHtml(html, nome, pasta)
      Email.js         Email.enviar({para, assunto, html, anexos})
      Log.js           Log.info / Log.erro (Logger + e-mail ao admin em erro crítico)
    dominio/
      Fluxo.js         ESTADOS, TRANSICOES, Fluxo.podeMover(de, para), Fluxo.mover(id, para, quem, obs)
      Pontuacao.js     Pontuacao.calcular({tipo, metros, largura, pesoKg, defeitos})
      Etiqueta.js      Etiqueta.interpretar(texto) → dados normalizados (também usado no cliente)
      Relatorio.js     Relatorio.html(rolo, fotos) → HTML do PDF
    areas/
      Revisao.js       iniciar, retomar, salvarFoto, removerFoto, concluir, cancelar
      Compras.js       listarCasos, detalhe, foto, gerarPdf, registrarRetorno
  client/
    comum/
      api.js           api(acao, dados) → Promise (acrescenta `responsavel`)
      responsavel.js   pede o nome uma vez e guarda no localStorage
      estilo.css
      foto.js          reduzir(file) → base64 JPEG 1600 px q0.75
      leitorQr.js      LeitorQr.abrir() → Promise<texto>
      etiqueta.js      mesmo código de dominio/Etiqueta.js, servido ao cliente
    revisao/  pagina.html  revisao.js
    compras/  pagina.html  compras.js
tests/
  dubles/            SpreadsheetApp, DriveApp, LockService, PropertiesService falsos
  dominio/           fluxo.test.js, pontuacao.test.js, etiqueta.test.js
  areas/             revisao.test.js, compras.test.js
```

### Dependências permitidas

```
client/*  ──api()──▶  main.js ──▶ areas/* ──▶ dominio/*
                                     └──────▶ infra/*  ──▶ APIs do Google
dominio/* ─X─▶ infra/*      areas/X ─X─▶ areas/Y      infra/* ─X─▶ dominio/*
```

### Roteamento de páginas e identificação

`doGet` aceita `?p=revisao|compras` (padrão: revisao) e `&rolo=REV-…` para abrir um rolo direto.

Não há perfis. O manifesto fica com `executeAs: USER_DEPLOYING` e `access: ANYONE` (exige login Google,
qualquer conta). Nesse modo `Session.getActiveUser().getEmail()` vem vazio para contas de fora do domínio,
então a identificação é o **nome informado na tela**: pedido na primeira vez, guardado no `localStorage` e
enviado pelo `api.js` como `responsavel` em toda chamada. O nome vai para INSPECOES.REVISOR e HISTORICO.QUEM.

### Conclusão da revisão (sequência)

```
revisao.concluir
  1. valida (fotos todas enviadas, medidas, ≤ 30 defeitos)
  2. grava DEFEITOS + pontuação em INSPECOES (lock)
  3. Fluxo.mover(id, 'EM_COMPRAS', responsavel)
  4. try  Pdf.deHtml(Relatorio.html(rolo, fotos)) → PDF_ID
     catch → registra erro, segue
  5. Email.enviar(EMAIL_COMPRAS, assunto "REV-… · fornecedor · NF", anexo PDF se houver, link ?p=compras&rolo=…)
  6. devolve { estado, pontuacao, pdf: { ok, url } }
```

O HTML do PDF é montado por `dominio/Relatorio.js`, um módulo puro (recebe `RoloCompleto` e as fotos em
base64, devolve HTML) e testável em Node. Ele é chamado por `Revisao.concluir` e por `Compras.gerarPdf`, o
que mantém o Artigo III (área não chama área).

### Mudanças de comportamento intencionais

| Hoje | Depois | Motivo |
|---|---|---|
| Aprovação automática com pontuação < 35 | Todo rolo concluído vai a compras | Só rolo com problema entra (decidido 2026-09-25) |
| Supervisor/gerente analisa e decide | Etapa removida; compras recebe direto | Processo mais curto (decidido 2026-09-25) |
| PDF gerado quando compras pede | PDF gerado na conclusão e enviado por e-mail | Compras recebe o caso pronto |
| Link assinado + Google Forms | Link direto para a tela de compras | Simplicidade |
| Acesso anônimo | Qualquer conta Google, sem perfis | Decisão do dono |
| Foto até 40 MB, enviada no fim | ~250 KB, enviada ao ser tirada | Desempenho e resiliência |
| PDF por cópia de modelo Google Docs | PDF a partir de HTML | Menos chamadas, sem arquivos temporários |
| AUDIT + TELEMETRIA + TEMPOS_LOG + JSON no rolo | Só HISTORICO | Um registro, legível |

## Estratégia de convivência com o legado

1. Código novo vive em `src/`. O legado continua em `App/`, `services/`, `ui/` etc.
2. Para não haver colisão, **todo nome novo é namespace** (`Planilha`, `Fluxo`...). Antes de criar,
   `grep -rn "NomeNovo" --include=*.js --include=*.html .` precisa voltar vazio.
3. Quando uma área nova assume uma função, a função global do legado vira **adaptador de uma linha**
   chamando o código novo. Adaptadores são listados em cada `plan.md` e removidos na 006.
4. Cada tela nova ganha uma rota nova (`?p=...`). A rota antiga (`?page=...`) continua até a virada.
5. Os estados antigos são lidos pelo `Fluxo` via tabela de conversão (`data-model.md`) até a migração
   final na 006.

## Entregas

| # | Entrega | Depende de | Estimativa | Remove (aprox.) |
|---|---|---|---|---|
| 001 | Leitor de QR leve | — | 2–3 dias | 3.100 linhas + 329 KB |
| 002 | Base do servidor (inclui `Relatorio` e PDF) | — | 4–5 dias | 5.500 linhas |
| 003 | Tela do revisor (conclusão gera PDF e avisa compras) | 001, 002 | 3–4 dias | 4.700 linhas |
| ~~004~~ | ~~Tela do gerente~~ — **cancelada** em 2026-09-25 | — | — | — |
| 005 | Tela de compras (casos, detalhe com fotos, PDF, retorno) | 002, 003 | 3 dias | 9.000 linhas (inclui `estoque.html`, `supervisor.html`) |
| 006 | Limpeza e virada | 003, 005 | 1 dia | restante do legado |

Antes da 001: **Fase 0** (≈1 dia) — ver `tasks.md`. Total estimado: 14–17 dias.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Colisão de nomes entre novo e legado | Alta | Namespaces + grep antes de criar + teste que carrega todos os `.js` num único contexto `vm` e falha em duplicata |
| Regra de pontuação mudar sem querer | Média | Testes de caracterização com casos reais antes de mover |
| Unidades confusas no legado (`len`/`wid`, largura em cm vs m) | Alta | Documentar em `data-model.md` e cobrir com testes usando etiquetas reais |
| Samsung Internet sem `BarcodeDetector` | Média | Orientar uso do Chrome; fallback jsQR carregado sob demanda |
| Limite de 6 min no PDF com muitas fotos | Baixa | Miniaturas de 1024 px no PDF; limite de 30 fotos |
| Conclusão lenta para o revisor (PDF + e-mail) | Média | Meta ≤ 20 s com indicador de progresso; se passar, mover PDF+e-mail para gatilho de tempo de 1 min |
| Nome digitado errado ou vazio | Média | Campo obrigatório; nome exibido no topo da tela com opção "trocar" |
| Rolos em andamento na virada | Média | Script de migração de estados idempotente, rodado primeiro na planilha de teste |

## Balanço de linhas

| Antes | Depois | Diferença |
|---|---|---|
| ~25.800 | 4.000–6.000 | −20.000 a −22.000 |
