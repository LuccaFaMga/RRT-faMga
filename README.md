# RRT Tecidos

Auditoria da revisão de rolos de tecido **com problema**, em Google Apps Script.
O revisor registra defeitos e fotos no celular; ao concluir, compras recebe o PDF por e-mail.

> Este projeto está em refatoração guiada por especificações (SDD).
> Comece por [`AGENTS.md`](AGENTS.md) e [`specs/README.md`](specs/README.md).

## Estrutura

| Pasta | Conteúdo | Vai para o Apps Script? |
|---|---|---|
| `App/`, `00services/`, `services/`, `controllers/`, `routers/`, `core/`, `ui/` | código legado (sai na entrega 006) | sim |
| `src/` | código novo (a partir da entrega 001) | sim |
| `tests/` | testes Node | não |
| `specs/`, `.specify/`, `*.md` | especificações SDD | não |

O que não vai para o Apps Script está em [`.claspignore`](.claspignore).

## Pré-requisitos

- Node.js 22 ou superior
- `clasp` (`npm install -g @google/clasp`) e `clasp login` com a conta dona do projeto

## Testes

```bash
npm test          # todos os testes
npm run globais   # lista funções globais repetidas entre arquivos do servidor
```

`tests/colisao-globais.test.js` falha se alguém criar uma função global com nome já usado em outro
arquivo. No Apps Script todos os arquivos dividem o mesmo escopo, então isso vira bug silencioso.

## Ambientes

As Script Properties pertencem ao **projeto** Apps Script, não à implantação. Por isso o ambiente de teste é
um **projeto separado** (uma cópia), com planilha e pasta de teste.

| Ambiente | Arquivo do clasp | Planilha | Quem publica |
|---|---|---|---|
| Teste | `.clasp.teste.json` | cópia de teste | qualquer desenvolvedor / agente |
| Produção | `.clasp.json` | planilha real | **somente o Lucca** |

### Criar o projeto de teste (uma vez)

1. No Google Drive, faça uma cópia da planilha e da pasta de saída. Anote os IDs (não coloque no Git).
2. Abra o projeto Apps Script de produção → **Visão geral** → **Fazer uma cópia**.
3. Na cópia: **Configurações do projeto** → copie o **ID do script**.
4. Crie `.clasp.teste.json` na raiz, igual ao `.clasp.json`, trocando só o `scriptId`.
5. Na cópia: **Configurações do projeto → Propriedades do script**, defina `SHEET_ID`, `OUTPUT_FOLDER_ID` e
   demais IDs apontando para as cópias de teste, e `EMAIL_COMPRAS` com o seu e-mail.
6. `clasp push -P .clasp.teste.json`, depois **Implantar → Nova implantação → App da Web**.

### Enviar código

```bash
clasp push -P .clasp.teste.json   # teste: sempre primeiro
clasp push                        # produção: só o Lucca, depois de validar no teste
```

Depois do push em produção, atualize a implantação existente (**Implantar → Gerenciar implantações →
Editar → Nova versão**) para manter a mesma URL.

## Configuração (Script Properties)

Todas as configurações ficam em **Configurações do projeto → Propriedades do script**. Na primeira vez em
cada projeto, rode pelo editor a função `configurarPropriedades_` (arquivo `core/Config.js`): ela copia os
valores padrão que ainda estão no código para as Properties, sem sobrescrever o que já existe. Depois ajuste
os valores pela tela de Propriedades.

| Propriedade | Uso |
|---|---|
| `SHEET_ID` | planilha de dados |
| `OUTPUT_FOLDER_ID` | pasta raiz de fotos e PDFs |
| `TEMPLATE_RELATORIO_ID`, `TEMPLATE_FOTOS_ID`, `LOGO_FILE_ID` | modelos e logo (legado) |
| `EMAIL_COMPRAS` | quem recebe o PDF (por enquanto, o e-mail do Lucca) |
| `EMAIL_ADMIN` | recebe alertas de erro crítico |
| `SECRET_KEY` | assinatura de links; **gerada automaticamente** no primeiro acesso se não existir |
| `REVISORES` | nomes dos revisores separados por `;` (a partir da entrega 003) |

## Exportar cabeçalhos da planilha (tarefa 000-T08)

Cole temporariamente num arquivo do projeto de **teste**, execute pelo editor e copie o registro de
execução para `specs/000-refatoracao/cabecalhos-atuais.md`. Depois apague a função.

```js
function exportarCabecalhos_() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const linhas = ss.getSheets().map(aba => {
    const n = aba.getLastColumn();
    const cab = n ? aba.getRange(1, 1, 1, n).getValues()[0] : [];
    return '## ' + aba.getName() + ' (' + aba.getLastRow() + ' linhas)\n\n' + cab.map(c => '- ' + c).join('\n');
  });
  Logger.log(linhas.join('\n\n'));
}
```

## Fluxo de trabalho (SDD)

especificar → esclarecer → planejar → quebrar em tarefas → implementar → verificar.
Detalhes em [`AGENTS.md`](AGENTS.md) §4. Um commit por tarefa: `NNN-Tx: descrição`.
