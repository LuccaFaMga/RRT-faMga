/**
 * Lista os nomes que cada arquivo de servidor define no escopo global do Apps Script.
 * No Apps Script todos os .js/.gs compartilham um único escopo: nomes repetidos entre
 * arquivos se sobrescrevem (function/var) ou quebram o projeto inteiro (const/let/class).
 * Análise por linha, suficiente para o estilo deste projeto: considera apenas
 * declarações começando na coluna 0.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const IGNORAR_PASTAS = new Set(['.git', 'node_modules', 'tests', 'tools', 'specs', '.specify', 'docs']);
const PALAVRAS_RESERVADAS = new Set(['if', 'for', 'while', 'return', 'switch', 'try', 'else', 'do', 'this']);

function arquivosDeServidor(dir = RAIZ) {
  const saida = [];
  for (const nome of fs.readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    const stat = fs.statSync(caminho);
    if (stat.isDirectory()) {
      if (!IGNORAR_PASTAS.has(nome)) saida.push(...arquivosDeServidor(caminho));
    } else if (/\.(js|gs)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida.sort();
}

function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function declaracoes(codigo) {
  const achados = [];
  semComentarios(codigo).split('\n').forEach((linha, i) => {
    let m;
    if ((m = linha.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/))) {
      achados.push({ nome: m[1], tipo: 'function', linha: i + 1 });
    } else if ((m = linha.match(/^(const|let|var|class)\s+([A-Za-z_$][\w$]*)(?:\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$)?/))) {
      // `var x = x;` só reexporta a mesma função: não é uma segunda definição
      if (m[3] !== m[2]) achados.push({ nome: m[2], tipo: m[1], linha: i + 1 });
    } else if ((m = linha.match(/^([A-Za-z_$][\w$]*)\s*=[^=]/)) && !PALAVRAS_RESERVADAS.has(m[1])) {
      achados.push({ nome: m[1], tipo: 'implicita', linha: i + 1 });
    }
  });
  return achados;
}

/** @returns {Map<string, {arquivo, tipo, linha}[]>} só os nomes definidos mais de uma vez */
function duplicados() {
  const porNome = new Map();
  for (const arquivo of arquivosDeServidor()) {
    const rel = path.relative(RAIZ, arquivo).split(path.sep).join('/');
    for (const d of declaracoes(fs.readFileSync(arquivo, 'utf8'))) {
      if (!porNome.has(d.nome)) porNome.set(d.nome, []);
      porNome.get(d.nome).push({ arquivo: rel, tipo: d.tipo, linha: d.linha });
    }
  }
  return new Map([...porNome].filter(([, locais]) => locais.length > 1));
}

module.exports = { arquivosDeServidor, declaracoes, duplicados };

if (require.main === module) {
  for (const [nome, locais] of duplicados()) {
    console.log(nome.padEnd(34), locais.map((l) => `${l.arquivo}:${l.linha} (${l.tipo})`).join('  '));
  }
}
