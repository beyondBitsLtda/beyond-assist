// O "Rodar" do exercício, a parte do navegador (pedido de 21/10/2026).
//
// JavaScript roda num Worker criado na hora: o console vira linhas na tela, o tempo-limite mata o
// Worker (um laço infinito não trava a página) e a rede fica desligada lá dentro. SQL roda no
// SQLite do sql.js (WebAssembly), baixado da CDN só na primeira vez que alguém roda SQL. As outras
// linguagens vão para /api/rodar (servidor → compilador on-line). Ver src/dominio/execucao.js.
//
// Todo resultado sai no mesmo formato:
//   { onde, rotulo, linhas: [{ tipo: "log"|"aviso"|"erro"|"info", texto }], tabelas: [...], ms }

import { criar } from "@/lib/api.js";
import { execucaoDoExercicio } from "@/dominio/execucao.js";

const TEMPO_DO_JS = 5000;
const TEMPO_DO_SQL = 20000; // inclui baixar o SQLite na primeira vez
const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
const MAX_LINHAS = 400;

// Dentro do Worker. `export`/`module.exports` comuns em exercício viram código que roda; `require`
// e `import` avisam que o Rodar é só JavaScript puro.
const TRABALHADOR_JS = `
const formatar = (v) => {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  if (typeof v === "function") return "[função " + (v.name || "anônima") + "]";
  if (v instanceof Error) return v.name + ": " + v.message;
  try { const t = JSON.stringify(v, null, 2); return t === undefined ? String(v) : t; } catch { return String(v); }
};
const mandar = (tipo, args) => postMessage({ tipo, texto: args.map(formatar).join(" ") });
console.log = (...a) => mandar("log", a);
console.info = console.log; console.debug = console.log; console.table = console.log;
console.warn = (...a) => mandar("aviso", a);
console.error = (...a) => mandar("erro", a);
const semRede = () => { throw new Error("o Rodar não acessa a internet"); };
self.fetch = semRede; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = semRede;
self.addEventListener("unhandledrejection", (e) => mandar("erro", ["Erro: " + formatar(e.reason)]));
onmessage = async (e) => {
  const module = { exports: {} };
  const require = (nome) => { throw new Error("require('" + nome + "') não funciona aqui: o Rodar é só JavaScript puro"); };
  try {
    const Assincrona = Object.getPrototypeOf(async function () {}).constructor;
    await new Assincrona("module", "exports", "require", e.data)(module, module.exports, require);
    postMessage({ tipo: "fim" });
  } catch (err) {
    const msg = String(err && err.message || err);
    const dica = /import statement|Cannot use import/i.test(msg) ? " (o Rodar não carrega módulos: deixe só o seu código)" : "";
    postMessage({ tipo: "erro", texto: (err && err.name ? err.name + ": " : "") + msg + dica });
    postMessage({ tipo: "fim" });
  }
};
self.onerror = (m) => { mandar("erro", [String(m)]); };
`;

/** `export function x` / `export default` / `export { a }`: no Rodar viram código comum. */
function semExport(codigo) {
  return String(codigo)
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^(\s*)export\s+(?=(async\s+)?function|const|let|var|class)/gm, "$1")
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "");
}

function trabalhador(fonte) {
  const url = URL.createObjectURL(new Blob([fonte], { type: "text/javascript" }));
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  return w;
}

function rodarJavaScript(codigo) {
  return new Promise((resolver) => {
    const inicio = performance.now();
    const linhas = [];
    const w = trabalhador(TRABALHADOR_JS);
    let acabou = false;
    const fechar = (extra) => {
      if (acabou) return;
      acabou = true;
      clearTimeout(limite);
      w.terminate();
      if (extra) linhas.push(extra);
      resolver({ linhas, ms: Math.round(performance.now() - inicio) });
    };
    // timers que o código deixou (setTimeout) ainda têm um instante para falar depois do fim
    let depois = null;
    w.onmessage = (e) => {
      const m = e.data || {};
      if (m.tipo === "fim") { depois = setTimeout(() => fechar(), 300); return; }
      if (linhas.length >= MAX_LINHAS) return fechar({ tipo: "info", texto: `… saída cortada em ${MAX_LINHAS} linhas` });
      linhas.push({ tipo: m.tipo, texto: m.texto });
    };
    w.onerror = (e) => { e.preventDefault?.(); linhas.push({ tipo: "erro", texto: e.message || "erro ao rodar" }); clearTimeout(depois); fechar(); };
    const limite = setTimeout(() => fechar({ tipo: "erro", texto: `Parou depois de ${TEMPO_DO_JS / 1000} s — o código tem um laço que não termina?` }), TEMPO_DO_JS);
    w.postMessage(semExport(codigo));
  });
}

const TRABALHADOR_SQL = `
importScripts("${SQLJS}sql-wasm.js");
const pronto = initSqlJs({ locateFile: (f) => "${SQLJS}" + f });
onmessage = async (e) => {
  try {
    const SQL = await pronto;
    const db = new SQL.Database();
    const resultados = db.exec(e.data);
    const mudou = db.getRowsModified();
    db.close();
    postMessage({ ok: true, mudou, tabelas: resultados.slice(0, 10).map((r) => ({ colunas: r.columns, linhas: r.values.slice(0, 200), total: r.values.length })) });
  } catch (err) {
    postMessage({ ok: false, erro: String(err && err.message || err) });
  }
};
`;

function rodarSql(codigo) {
  return new Promise((resolver) => {
    const inicio = performance.now();
    const w = trabalhador(TRABALHADOR_SQL);
    const fechar = (r) => { clearTimeout(limite); w.terminate(); resolver({ ...r, ms: Math.round(performance.now() - inicio) }); };
    w.onmessage = (e) => {
      const m = e.data || {};
      if (!m.ok) {
        const linhas = [{ tipo: "erro", texto: m.erro }];
        if (/no such table/i.test(m.erro)) linhas.push({ tipo: "info", texto: "Dica: o Rodar começa com um banco vazio. Crie a tabela e alguns dados de teste (CREATE TABLE e INSERT) antes do SELECT." });
        return fechar({ linhas, tabelas: [] });
      }
      const linhas = m.tabelas.length ? [] : [{ tipo: "info", texto: m.mudou ? `Pronto: ${m.mudou} linha(s) alterada(s). Faça um SELECT para ver os dados.` : "Rodou sem erro, mas nenhum SELECT devolveu linhas." }];
      fechar({ linhas, tabelas: m.tabelas });
    };
    w.onerror = (e) => { e.preventDefault?.(); fechar({ linhas: [{ tipo: "erro", texto: "Não consegui carregar o SQLite — confira a internet e tente de novo." }], tabelas: [] }); };
    const limite = setTimeout(() => fechar({ linhas: [{ tipo: "erro", texto: "O SQL demorou demais para rodar." }], tabelas: [] }), TEMPO_DO_SQL);
    w.postMessage(String(codigo));
  });
}

async function rodarNoServidor(exec, { linguagem, tema, codigo, entrada }) {
  const inicio = performance.now();
  const { resultado: r } = await criar("/api/rodar", { linguagem, tema, codigo, entrada });
  const linhas = [];
  if (r.compilacao) linhas.push({ tipo: r.falhouNaCompilacao ? "erro" : "aviso", texto: r.compilacao });
  if (r.saida) linhas.push({ tipo: "log", texto: r.saida.replace(/\n$/, "") });
  if (r.erro) linhas.push({ tipo: "erro", texto: r.erro.replace(/\n$/, "") });
  if (r.sinal) linhas.push({ tipo: "erro", texto: `O programa foi interrompido (${r.sinal}).` });
  if (!linhas.length) linhas.push({ tipo: "info", texto: "Rodou sem erro, mas não imprimiu nada." });
  if (r.status && !r.falhouNaCompilacao) linhas.push({ tipo: "info", texto: `Terminou com código de saída ${r.status}.` });
  return { linhas, tabelas: [], ms: Math.round(performance.now() - inicio) };
}

/** Roda o código do exercício onde a linguagem dele roda. Falha de rede vira linha de erro. */
export async function rodarCodigo({ linguagem, tema, codigo, entrada = "" }) {
  const exec = execucaoDoExercicio(linguagem, tema);
  if (!exec) return { onde: null, rotulo: "", linhas: [{ tipo: "erro", texto: "Esta linguagem ainda não roda no Proof." }], tabelas: [], ms: 0 };
  try {
    const r = exec.chave === "javascript" ? await rodarJavaScript(codigo)
      : exec.chave === "sql" ? await rodarSql(codigo)
      : await rodarNoServidor(exec, { linguagem, tema, codigo, entrada });
    const semSaida = exec.chave === "javascript" && !r.linhas.length;
    return {
      onde: exec.onde,
      rotulo: exec.rotulo,
      ...r,
      linhas: semSaida ? [{ tipo: "info", texto: "Rodou sem erro, mas não imprimiu nada. Chame a sua função dentro de um console.log(...) para ver o resultado." }] : r.linhas,
    };
  } catch (e) {
    return { onde: exec.onde, rotulo: exec.rotulo, linhas: [{ tipo: "erro", texto: e.message || "não consegui rodar agora" }], tabelas: [], ms: 0 };
  }
}
