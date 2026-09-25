# Contrato da API: RRT Tecidos

**Referência de:** `specs/000-refatoracao/plan.md` · **Atualizado em:** 2026-09-25 (rev. 2 — sem gerente, sem perfis)

Toda comunicação cliente → servidor passa por uma única função:

```js
// cliente
api(acao: string, dados: object) → Promise<resultado>

// servidor (main.js)
function api(acao, dados) → resultado | { erro: string }
```

## Convenções

- `acao` no formato `area.verbo`. Ação fora desta lista retorna `{ erro: 'Ação desconhecida: ...' }`.
- Sucesso: o objeto de resultado descrito abaixo (nunca `{status:'OK'}` genérico).
- Falha esperada (validação, transição inválida): `{ erro: 'mensagem para o usuário' }`.
  O `api.js` do cliente transforma em `Promise.reject(new Error(msg))`.
- Datas sempre em ISO 8601. Números sempre `number`, nunca string com vírgula.
- **Sem perfis.** Qualquer conta Google logada pode chamar qualquer ação.
- **Quem fez:** toda ação que grava recebe `responsavel` (nome digitado uma vez na tela e guardado no
  `localStorage` do aparelho). O `api.js` do cliente acrescenta esse campo automaticamente em todas as
  chamadas. O servidor recusa gravação com `responsavel` vazio.

## Ações

### Revisão

| Ação | Entrada | Saída | Efeitos |
|---|---|---|---|
| `revisao.iniciar` | `{ etiqueta: EtiquetaDados, tipoTecido }` | `{ revisionId, estado, revisoesAnteriores: string[] }` | Sempre cria nova revisão, mesmo que o rolo já tenha passado pelo sistema (as anteriores são listadas). Nova linha em INSPECOES (`EM_REVISAO`), pasta no Drive, evento em HISTORICO |
| `revisao.retomar` | `{}` | `Revisao \| null` | Devolve a revisão `EM_REVISAO` aberta (no máximo uma: só um revisor usa o app por vez) |
| `revisao.salvarFoto` | `{ revisionId, base64, tipo, defeitoId? }` | `{ fotoId }` | Arquivo no Drive + linha em FOTOS. `base64` ≤ 2,5 MB |
| `revisao.removerFoto` | `{ revisionId, fotoId }` | `{ ok: true }` | Lixeira do Drive + remove linha |
| `revisao.concluir` | `{ revisionId, medidas, defeitos: Defeito[], obs }` | `{ revisionId, estado, pontuacao, pdf: { ok, url? } }` | Grava DEFEITOS e pontuação, move para `EM_COMPRAS`, **gera o PDF e envia e-mail a compras** com o PDF anexado e link `?p=compras&rolo=…`. Se o PDF falhar, o estado muda mesmo assim e o e-mail avisa a falha |
| `revisao.cancelar` | `{ revisionId, motivo }` | `{ estado }` | Move para `CANCELADO` |

### Compras

| Ação | Entrada | Saída | Efeitos |
|---|---|---|---|
| `compras.casos` | `{ incluirEncerrados?: boolean }` | `ResumoRolo[]` | — |
| `compras.detalhe` | `{ revisionId }` | `RoloCompleto` | — |
| `compras.foto` | `{ fotoId, tamanho: 'mini'\|'grande' }` | `{ dataUrl }` | — |
| `compras.gerarPdf` | `{ revisionId, observacao }` | `{ pdfId, url }` | Salva OBS_COMPRAS, gera PDF de novo na pasta do rolo (substitui o anterior) |
| `compras.registrarRetorno` | `{ revisionId, resultado: 'ACEITO'\|'ABATIMENTO'\|'DEVOLUCAO', obs }` | `{ estado }` | `ACEITO`/`ABATIMENTO` → `LIBERADO`; `DEVOLUCAO` → `DEVOLVIDO` |

## Tipos

```ts
type EtiquetaDados = {
  fornecedorId, fornecedor, nf, produtoId, produtoFornecedor, lote,
  cor, padronagem, localizacao, composicao: string;
  metrosFornecedor?: number; larguraCm?: number;
  bruto: string;            // texto original lido do QR
  origem: 'video' | 'foto' | 'digitado';
};

type Defeito = {
  defeitoId?: string; tipo: string; metroInicial: number; metroFinal: number;
  gravidade: 1 | 2 | 3 | 4; zona: string[]; observacao?: string;
};

type Pontuacao = {
  pontos: number; referencia: number | null; limite: number;
  unidade: 'pts/100m2' | 'pts/100kg';
  alertas: string[];        // furos excedidos, pontos/metro excedido, cálculo insuficiente
};

type ResumoRolo = {
  revisionId, fornecedor, nf, produtoId, lote, estado, revisor: string;
  pontuacao: Pontuacao; esperaHoras: number; qtdFotos: number; temPdf: boolean;
};

type RoloCompleto = ResumoRolo & {
  etiqueta: EtiquetaDados; medidas: { metrosRevisado, larguraCm, pesoKg, tipoTecido };
  defeitos: Defeito[]; fotos: { fotoId, tipo, defeitoId? }[];
  historico: { de, para, quem, quando, observacao }[];
  obsRevisor?: string; obsCompras?: string; pdfId?: string; pdfUrl?: string;
  resultadoFornecedor?: 'ACEITO' | 'ABATIMENTO' | 'DEVOLUCAO';
};
```

## Rotas de página (`doGet`)

| URL | Página |
|---|---|
| `?p=revisao` (padrão) | Revisão |
| `?p=compras[&rolo=REV-...]` | Compras |

Rotas legadas `?page=...` continuam até a entrega 006.
