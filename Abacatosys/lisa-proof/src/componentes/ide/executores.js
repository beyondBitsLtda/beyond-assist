// Os executores da IDE livre (05/11/2026): quem roda de verdade o que o terminal pede (src/dominio/shell.js).
//
//   JavaScript → um Worker do navegador que imita o Node: require/import entre os arquivos do projeto, fs (lê e grava
//                no projeto), path, readline, process, e os pacotes do npm baixados do esm.sh. fetch funciona para a
//                internet, mas não para o próprio Proof (o programa não fala com a sua conta).
//   Python     → o Pyodide (CPython em WebAssembly), num Worker que fica vivo entre as rodadas: pip install (micropip),
//                os pacotes científicos importados sozinhos (numpy, pandas...), input() com a entrada do terminal, e
//                os arquivos que o programa grava voltam para o projeto.
//   SQL        → o SQLite do sql.js, num Worker por banco; o banco.db é guardado no projeto (em base64).
//   Os outros  → o compilador on-line (Wandbox) pela rota /api/ide/rodar, com os arquivos do projeto junto.
//
// Tudo devolve { saida, erro, status, projeto?, jaEscreveu } — `jaEscreveu`: a saída já foi para a tela ao vivo.

import { criar } from "@/lib/api.js";
import { IDE, escrever, remover, ehArquivo, pastaDe, nomeDe, normalizarCaminho, linguagemDoArquivo, extensaoDe } from "@/dominio/ide.js";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
const TEMPO_DO_JS = 30_000;
const TEMPO_DO_PYTHON = 60_000;
export const MARCA_DO_BANCO = "#!proof-sqlite base64\n";

const trabalhador = (codigo) => new Worker(URL.createObjectURL(new Blob([codigo], { type: "text/javascript" })));

// ================================================================== JavaScript

// Dentro do Worker: o "Node" do navegador.
const NODE_DO_NAVEGADOR = String.raw`
const PROOF = self.location.origin;
const formatar = (v, raiz = true) => {
  if (typeof v === "string") return raiz ? v : inspecionar(v, 1, new WeakSet());
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "function") return "[Function: " + (v.name || "(anônima)") + "]";
  if (typeof v === "symbol" || typeof v === "bigint") return String(v) + (typeof v === "bigint" ? "n" : "");
  if (v instanceof Error) return (v.stack && !/^\s*at /m.test(v.stack) ? v.stack : v.name + ": " + v.message);
  if (v instanceof Map) return "Map(" + v.size + ") {" + [...v].map(([k, x]) => " " + formatar(k, false) + " => " + formatar(x, false)).join(",") + " }";
  if (v instanceof Set) return "Set(" + v.size + ") {" + [...v].map((x) => " " + formatar(x, false)).join(",") + " }";
  if (v instanceof Date) return v.toISOString();
  return inspecionar(v, 0, new WeakSet());
};
// como o util.inspect do Node: [ 1, 2 ] e { nome: 'Ana' } numa linha quando cabe; quebrado com recuo quando não
const IDENT = /^[A-Za-z_$][\w$]*$/;
const inspecionar = (v, nivel, vistos) => {
  if (v === null) return "null";
  if (typeof v === "string") return nivel ? "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'" : v;
  if (typeof v !== "object") return typeof v === "function" ? "[Function: " + (v.name || "(anônima)") + "]" : typeof v === "bigint" ? v + "n" : String(v);
  if (vistos.has(v)) return "[Circular *]";
  if (v instanceof Error) return "[" + v.name + ": " + v.message + "]";
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Map || v instanceof Set) return formatar(v);
  if (nivel > 3) return Array.isArray(v) ? "[Array]" : "[Object]";
  vistos.add(v);
  const ehLista = Array.isArray(v);
  const partes = ehLista ? v.slice(0, 100).map((x) => inspecionar(x, nivel + 1, vistos)) : Object.keys(v).slice(0, 100).map((k) => (IDENT.test(k) ? k : "'" + k + "'") + ": " + inspecionar(v[k], nivel + 1, vistos));
  if (ehLista && v.length > 100) partes.push("... mais " + (v.length - 100) + " itens");
  vistos.delete(v);
  const nome = !ehLista && v.constructor && v.constructor !== Object && v.constructor.name ? v.constructor.name + " " : "";
  if (!partes.length) return ehLista ? "[]" : nome + "{}";
  const [a, b] = ehLista ? ["[", "]"] : ["{", "}"];
  const umaLinha = nome + a + " " + partes.join(", ") + " " + b;
  if (umaLinha.length <= 72 && !umaLinha.includes("\n")) return umaLinha;
  const recuo = "  ".repeat(nivel + 1);
  return nome + a + "\n" + partes.map((p) => recuo + p).join(",\n") + "\n" + "  ".repeat(nivel) + b;
};
const formatarTudo = (args) => {
  if (typeof args[0] === "string" && /%[sdifoOj%]/.test(args[0])) {
    let i = 1;
    const t = args[0].replace(/%([sdifoOj%])/g, (m, c) => c === "%" ? "%" : i >= args.length ? m : c === "d" || c === "i" ? String(parseInt(args[i++], 10)) : c === "f" ? String(parseFloat(args[i++])) : c === "s" ? String(args[i++]) : formatar(args[i++], false));
    return [t, ...args.slice(i).map((a) => formatar(a))].join(" ");
  }
  return args.map((a) => formatar(a)).join(" ");
};
const mandar = (tipo, texto) => postMessage({ tipo, texto });
let recuo = "";
console.log = (...a) => mandar("saida", recuo + formatarTudo(a) + "\n");
console.info = console.log; console.debug = console.log;
console.warn = (...a) => mandar("erro", recuo + formatarTudo(a) + "\n");
console.error = console.warn;
console.group = (...a) => { if (a.length) console.log(...a); recuo += "  "; };
console.groupEnd = () => { recuo = recuo.slice(2); };
console.table = (dados) => {
  if (!dados || typeof dados !== "object") return console.log(dados);
  const linhas = Object.entries(dados);
  const colunas = [...new Set(linhas.flatMap(([, v]) => (v && typeof v === "object" ? Object.keys(v) : ["Valores"])))];
  const tab = [["(índice)", ...colunas], ...linhas.map(([k, v]) => [k, ...colunas.map((c) => (v && typeof v === "object" ? formatar(v[c], false) : c === "Valores" ? formatar(v, false) : ""))])];
  const larg = tab[0].map((_, i) => Math.max(...tab.map((l) => String(l[i]).length)));
  const linha = (l) => "│ " + l.map((x, i) => String(x).padEnd(larg[i])).join(" │ ") + " │";
  const sep = (a, b, c) => a + larg.map((w) => "─".repeat(w + 2)).join(b) + c;
  mandar("saida", [sep("┌", "┬", "┐"), linha(tab[0]), sep("├", "┼", "┤"), ...tab.slice(1).map(linha), sep("└", "┴", "┘")].join("\n") + "\n");
};
const contagens = new Map();
console.count = (r = "default") => { contagens.set(r, (contagens.get(r) || 0) + 1); console.log(r + ": " + contagens.get(r)); };
const tempos = new Map();
console.time = (r = "default") => tempos.set(r, performance.now());
console.timeEnd = (r = "default") => { if (tempos.has(r)) console.log(r + ": " + (performance.now() - tempos.get(r)).toFixed(3) + "ms"); tempos.delete(r); };
console.assert = (c, ...a) => { if (!c) console.error("Assertion failed:", ...a); };

// a rede: a internet sim, o próprio Proof não (o programa não fala com a sua conta)
const fetchDeVerdade = self.fetch.bind(self);
const doProof = (url) => { try { return new URL(String(url && url.url || url), PROOF).origin === PROOF; } catch { return false; } };
self.fetch = (url, opcoes) => doProof(url) ? Promise.reject(new Error("o programa não pode chamar o próprio Proof")) : fetchDeVerdade(url, opcoes);
self.XMLHttpRequest = undefined;
self.importScripts = () => { throw new Error("importScripts não funciona aqui: use require ou import"); };
const WS = self.WebSocket;
self.WebSocket = function (url, p) { if (doProof(url)) throw new Error("o programa não pode abrir conexão com o próprio Proof"); return new WS(url, p); };

// os relógios: o programa termina quando o código acabou E não sobrou timer (como o Node)
const vivos = new Set();
const st = self.setTimeout.bind(self), ct = self.clearTimeout.bind(self), si = self.setInterval.bind(self), ci = self.clearInterval.bind(self);
self.setTimeout = (f, ms, ...a) => { const id = st(() => { vivos.delete(id); try { typeof f === "function" ? f(...a) : null; } catch (e) { erroFatal(e); } }, ms); vivos.add(id); return id; };
self.clearTimeout = (id) => { vivos.delete(id); ct(id); };
self.setInterval = (f, ms, ...a) => { const id = si(() => { try { f(...a); } catch (e) { erroFatal(e); } }, ms); vivos.add("i" + id); return id; };
self.clearInterval = (id) => { vivos.delete("i" + id); ci(id); };
self.setImmediate = (f, ...a) => self.setTimeout(f, 0, ...a);
self.queueMicrotask = self.queueMicrotask || ((f) => Promise.resolve().then(f));

// ---- o projeto (o "disco") e a entrada
let ARQUIVOS = {}, CWD = "/", ENTRADA = [], MUDOU = new Map(), PACOTES = new Map();
const normalizar = (atual, alvo) => {
  const base = String(alvo).startsWith("/") ? [] : String(atual).split("/").filter(Boolean);
  for (const p of String(alvo).split("/")) { if (!p || p === ".") continue; if (p === "..") base.pop(); else base.push(p); }
  return "/" + base.join("/");
};
const pastaDe = (c) => { const p = c.split("/").filter(Boolean); p.pop(); return "/" + p.join("/"); };
const lerLinha = () => (ENTRADA.length ? ENTRADA.shift() : null);
self.prompt = (pergunta = "") => {
  const l = lerLinha();
  mandar("saida", String(pergunta) + (l === null ? "\n" : l + "\n"));
  return l;
};
self.alert = (m) => console.log(String(m));
self.confirm = (m) => { const l = self.prompt(String(m) + " (s/n) "); return /^s|^y/i.test(l || ""); };

class SaidaDoProcesso extends Error { constructor(codigo) { super("process.exit(" + codigo + ")"); this.codigo = codigo; } }
const ouvintes = {};
const emissor = () => {
  const o = {};
  return {
    on(ev, f) { (o[ev] = o[ev] || []).push(f); return this; }, once(ev, f) { const g = (...a) => { this.off(ev, g); f(...a); }; return this.on(ev, g); },
    off(ev, f) { o[ev] = (o[ev] || []).filter((x) => x !== f); return this; }, removeListener(ev, f) { return this.off(ev, f); },
    emit(ev, ...a) { (o[ev] || []).slice().forEach((f) => f(...a)); return Boolean((o[ev] || []).length); }, addListener(ev, f) { return this.on(ev, f); },
    removeAllListeners(ev) { if (ev) delete o[ev]; else for (const k in o) delete o[k]; return this; }, listeners(ev) { return o[ev] || []; },
  };
};
class EventEmitter { constructor() { Object.assign(this, emissor()); } }
const stdin = Object.assign(emissor(), { isTTY: false, setEncoding() {}, resume() {}, pause() {} });
self.process = {
  argv: ["node"], env: {}, platform: "browser", version: "v20.0.0", versions: { node: "20.0.0" }, pid: 1, arch: "wasm",
  exitCode: 0, cwd: () => CWD, chdir: (d) => { CWD = normalizar(CWD, d); }, uptime: () => performance.now() / 1000,
  hrtime: Object.assign((a) => { const t = performance.now() * 1e6; const s = Math.floor(t / 1e9), n = Math.floor(t % 1e9); return a ? [s - a[0], n - a[1]] : [s, n]; }, { bigint: () => BigInt(Math.floor(performance.now() * 1e6)) }),
  memoryUsage: () => ({ heapUsed: 0, heapTotal: 0, rss: 0 }), nextTick: (f, ...a) => queueMicrotask(() => f(...a)),
  stdout: { write: (t) => { mandar("saida", String(t)); return true; }, isTTY: false, columns: 100 },
  stderr: { write: (t) => { mandar("erro", String(t)); return true; } },
  stdin, exit: (c = 0) => { throw new SaidaDoProcesso(c); }, on: (ev, f) => { (ouvintes[ev] = ouvintes[ev] || []).push(f); return self.process; },
};
self.global = self; self.globalThis = self;

// ---- os módulos de dentro
const fsSinc = {
  readFileSync(c, opc) {
    if (c === 0 || c === "/dev/stdin") { const t = ENTRADA.join("\n"); ENTRADA = []; return t; }
    const a = normalizar(CWD, c);
    if (!(a in ARQUIVOS)) { const e = new Error("ENOENT: no such file or directory, open '" + c + "'"); e.code = "ENOENT"; throw e; }
    return ARQUIVOS[a];
  },
  writeFileSync(c, dados) { const a = normalizar(CWD, c); ARQUIVOS[a] = String(dados); MUDOU.set(a, ARQUIVOS[a]); },
  appendFileSync(c, dados) { const a = normalizar(CWD, c); ARQUIVOS[a] = (ARQUIVOS[a] || "") + String(dados); MUDOU.set(a, ARQUIVOS[a]); },
  existsSync(c) { const a = normalizar(CWD, c); return a in ARQUIVOS || Object.keys(ARQUIVOS).some((k) => k.startsWith(a === "/" ? "/" : a + "/")); },
  readdirSync(c = ".") { const a = normalizar(CWD, c); const p = a === "/" ? "/" : a + "/"; return [...new Set(Object.keys(ARQUIVOS).filter((k) => k.startsWith(p)).map((k) => k.slice(p.length).split("/")[0]))].sort(); },
  mkdirSync() {}, rmSync(c) { fsSinc.unlinkSync(c); },
  unlinkSync(c) { const a = normalizar(CWD, c); delete ARQUIVOS[a]; MUDOU.set(a, null); },
  renameSync(de, para) { const a = normalizar(CWD, de), b = normalizar(CWD, para); ARQUIVOS[b] = ARQUIVOS[a]; delete ARQUIVOS[a]; MUDOU.set(a, null); MUDOU.set(b, ARQUIVOS[b]); },
  statSync(c) { const a = normalizar(CWD, c); const arq = a in ARQUIVOS; if (!arq && !fsSinc.existsSync(c)) { const e = new Error("ENOENT: '" + c + "'"); e.code = "ENOENT"; throw e; } return { isFile: () => arq, isDirectory: () => !arq, size: arq ? ARQUIVOS[a].length : 0, mtime: new Date() }; },
};
const fs = { ...fsSinc, promises: Object.fromEntries(Object.entries(fsSinc).map(([k, f]) => [k.replace(/Sync$/, ""), async (...a) => f(...a)])) };
for (const k of Object.keys(fsSinc)) fs[k.replace(/Sync$/, "")] = (...a) => { const cb = typeof a[a.length - 1] === "function" ? a.pop() : null; try { const r = fsSinc[k](...a); cb && queueMicrotask(() => cb(null, r)); } catch (e) { cb && queueMicrotask(() => cb(e)); } };
const path = {
  sep: "/", delimiter: ":", join: (...p) => normalizar("/", p.join("/")).replace(/^\//, p[0] && String(p[0]).startsWith("/") ? "/" : ""),
  resolve: (...p) => p.reduce((acc, x) => normalizar(acc, x), CWD), basename: (c, ext) => { const b = String(c).split("/").filter(Boolean).pop() || ""; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  dirname: (c) => pastaDe(String(c)), extname: (c) => { const b = path.basename(c); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; },
  normalize: (c) => normalizar("/", c), isAbsolute: (c) => String(c).startsWith("/"), relative: (a, b) => b, parse: (c) => ({ root: "/", dir: pastaDe(c), base: path.basename(c), ext: path.extname(c), name: path.basename(c, path.extname(c)) }),
};
path.posix = path;
const readline = {
  createInterface() {
    const rl = Object.assign(emissor(), {
      // os relógios acompanhados (self.setTimeout): o programa só termina depois que a entrada foi lida
      question(q, cb) { const l = self.prompt(q); self.setTimeout(() => (l === null ? rl.emit("close") : cb(l)), 0); },
      close() { if (!rl.fechado) { rl.fechado = true; self.setTimeout(() => rl.emit("close"), 0); } }, setPrompt() {}, prompt() {}, write(t) { mandar("saida", String(t)); }, pause() {}, resume() {},
      [Symbol.asyncIterator]: async function* () { let l; while ((l = lerLinha()) !== null) yield l; },
    });
    self.setTimeout(() => { if (!rl.listeners("line").length) return; let l; while ((l = lerLinha()) !== null) rl.emit("line", l); rl.close(); }, 0);
    return rl;
  },
};
readline.promises = { createInterface: () => ({ question: async (q) => self.prompt(q) ?? "", close() {} }) };
const util = { format: (...a) => formatarTudo(a), inspect: (v) => formatar(v, false), promisify: (f) => (...a) => new Promise((ok, ko) => f(...a, (e, r) => (e ? ko(e) : ok(r)))), isDeepStrictEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), types: {} };
const assert = Object.assign((c, m) => { if (!c) throw new Error(m || "AssertionError"); }, {
  ok: (c, m) => assert(c, m), equal: (a, b, m) => assert(a == b, m || formatar(a, false) + " == " + formatar(b, false)), strictEqual: (a, b, m) => assert(Object.is(a, b), m || formatar(a, false) + " === " + formatar(b, false)),
  deepStrictEqual: (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), m || "os valores não são iguais"), deepEqual: (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), m || "os valores não são iguais"),
  notEqual: (a, b, m) => assert(a != b, m), notStrictEqual: (a, b, m) => assert(!Object.is(a, b), m), throws: (f, _e, m) => { try { f(); } catch { return; } throw new Error(m || "a função não lançou erro"); },
});
const os = { EOL: "\n", platform: () => "browser", cpus: () => [{ model: "navegador" }], homedir: () => "/", tmpdir: () => "/tmp", hostname: () => "proof", type: () => "Proof", arch: () => "wasm", totalmem: () => 0, freemem: () => 0 };
const crypto = { randomUUID: () => self.crypto.randomUUID(), randomInt: (a, b) => (b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a))), randomBytes: (n) => self.crypto.getRandomValues(new Uint8Array(n)), webcrypto: self.crypto };
const DE_DENTRO = { fs, "fs/promises": fs.promises, path, readline, "readline/promises": readline.promises, util, events: Object.assign(EventEmitter, { EventEmitter }), assert, "assert/strict": assert, os, crypto, process: self.process, timers: { setTimeout: self.setTimeout, setInterval: self.setInterval, clearTimeout: self.clearTimeout, clearInterval: self.clearInterval } };

// ---- ESM → CommonJS (o suficiente para quem estuda: import/export entre os arquivos do projeto e dos pacotes)
const paraCommonJS = (codigo) => {
  if (!/^\s*(import\s|export\s)/m.test(codigo)) return codigo;
  const depois = [];
  let t = codigo
    .replace(/^\s*import\s+([\w$]+)\s*,\s*\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?/gm, (_, d, n, m) => "const " + d + " = __padrao(require(" + m + ")); const {" + n.replace(/\s+as\s+/g, ": ") + "} = require(" + m + ");")
    .replace(/^\s*import\s+\*\s+as\s+([\w$]+)\s+from\s*(['"][^'"]+['"]);?/gm, (_, n, m) => "const " + n + " = require(" + m + ");")
    .replace(/^\s*import\s*\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?/gm, (_, n, m) => "const {" + n.replace(/\s+as\s+/g, ": ") + "} = require(" + m + ");")
    .replace(/^\s*import\s+([\w$]+)\s+from\s*(['"][^'"]+['"]);?/gm, (_, n, m) => "const " + n + " = __padrao(require(" + m + "));")
    .replace(/^\s*import\s*(['"][^'"]+['"]);?/gm, (_, m) => "require(" + m + ");")
    .replace(/^\s*export\s+default\s+(async\s+)?function\s*\*?\s*([\w$]*)/gm, (_, a, n) => { const nome = n || "__padrao_exportado"; depois.push("module.exports.default = " + nome + ";"); return (a || "") + "function " + nome; })
    .replace(/^\s*export\s+default\s+class\s+([\w$]+)/gm, (_, n) => { depois.push("module.exports.default = " + n + ";"); return "class " + n; })
    .replace(/^\s*export\s+default\s+/gm, "module.exports.default = ")
    .replace(/^\s*export\s+(async\s+)?function\s*(\*?)\s*([\w$]+)/gm, (_, a, g, n) => { depois.push("module.exports." + n + " = " + n + ";"); return (a || "") + "function" + g + " " + n; })
    .replace(/^\s*export\s+class\s+([\w$]+)/gm, (_, n) => { depois.push("module.exports." + n + " = " + n + ";"); return "class " + n; })
    .replace(/^\s*export\s+(const|let|var)\s+([\w$]+)/gm, (_, k, n) => { depois.push("module.exports." + n + " = " + n + ";"); return k + " " + n; })
    .replace(/^\s*export\s*\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?/gm, (_, n, m) => n.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [a, b] = x.split(/\s+as\s+/); return "module.exports." + (b || a) + " = require(" + m + ")." + a + ";"; }).join(" "))
    .replace(/^\s*export\s*\{([^}]*)\};?/gm, (_, n) => { n.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => { const [a, b] = x.split(/\s+as\s+/); depois.push("module.exports." + (b || a) + " = " + a + ";"); }); return ""; });
  // na mesma 1ª linha: as linhas dos erros continuam batendo com o arquivo
  return "Object.defineProperty(module.exports, '__esModule', { value: true }); " + t + "\n" + depois.join("\n");
};
self.__padrao = (m) => (m && m.__esModule ? m.default : m && m.default !== undefined && Object.keys(m).length === 1 ? m.default : m);

const cache = new Map();
const Assincrona = Object.getPrototypeOf(async function () {}).constructor;
const resolver = (de, nome) => {
  const base = normalizar(pastaDe(de), nome);
  for (const c of [base, base + ".js", base + ".mjs", base + ".cjs", base + ".json", base + "/index.js"]) if (c in ARQUIVOS) return c;
  return null;
};
const criarRequire = (de) => (nome) => {
  nome = String(nome).replace(/^node:/, "");
  if (DE_DENTRO[nome]) return DE_DENTRO[nome];
  if (nome.startsWith(".") || nome.startsWith("/")) {
    const c = resolver(de, nome);
    if (!c) { const e = new Error("Cannot find module '" + nome + "' (em " + de + ")"); e.code = "MODULE_NOT_FOUND"; throw e; }
    if (cache.has(c)) return cache.get(c).exports;
    const module = { exports: {}, id: c, filename: c, loaded: false };
    cache.set(c, module);
    if (c.endsWith(".json")) { module.exports = JSON.parse(ARQUIVOS[c]); return module.exports; }
    const f = new Function("module", "exports", "require", "__filename", "__dirname", paraCommonJS(ARQUIVOS[c]) + "\n//# sourceURL=" + c);
    f(module, module.exports, criarRequire(c), c, pastaDe(c));
    module.loaded = true;
    return module.exports;
  }
  const raiz = nome.startsWith("@") ? nome.split("/").slice(0, 2).join("/") : nome.split("/")[0];
  if (PACOTES.has(nome)) return PACOTES.get(nome);
  if (PACOTES.has(raiz)) return PACOTES.get(raiz);
  const e = new Error("Cannot find module '" + nome + "' — instale com: npm install " + raiz); e.code = "MODULE_NOT_FOUND"; throw e;
};
const especificadores = (codigo) => {
  const s = new Set();
  for (const m of String(codigo).matchAll(/(?:require\s*\(\s*|from\s+|import\s*\(\s*|^\s*import\s+)['"]([^'"./][^'"]*)['"]/gm)) s.add(m[1]);
  return [...s].filter((n) => !DE_DENTRO[n.replace(/^node:/, "")] && !/^https?:/.test(n));
};
const carregarPacotes = async (versoes) => {
  const nomes = new Set();
  for (const t of Object.values(ARQUIVOS)) for (const n of especificadores(t)) nomes.add(n);
  for (const n of nomes) {
    if (PACOTES.has(n)) continue;
    const raiz = n.startsWith("@") ? n.split("/").slice(0, 2).join("/") : n.split("/")[0];
    const versao = versoes[raiz] && versoes[raiz] !== "latest" ? "@" + versoes[raiz].replace(/^[\^~]/, "") : "";
    const url = "https://esm.sh/" + raiz + versao + n.slice(raiz.length);
    try {
      const m = await import(url);
      PACOTES.set(n, m.default && Object.keys(m).length <= 2 ? Object.assign(m.default, m) : m);
    } catch (e) { throw new Error("não consegui baixar o pacote " + n + " do esm.sh (" + (e.message || e) + ")"); }
  }
};

let terminou = false;
const fim = (status) => {
  if (terminou) return; terminou = true;
  postMessage({ tipo: "fim", status, mudou: [...MUDOU.entries()] });
};
const erroFatal = (e) => {
  if (e instanceof SaidaDoProcesso) return fim(e.codigo);
  // a pilha só com os arquivos do projeto; a função que embrulha o arquivo soma 2 linhas no começo
  const msg = e && e.stack ? String(e.stack).split("\n").filter((l) => !/at (new Function|eval|Object\.<anonymous>|Object\.onmessage|onmessage|criarRequire|executar)|blob:|evalmachine/.test(l)).slice(0, 6)
    .map((l) => l.replace(/(\/[^\s():]+):(\d+):(\d+)/, (_, c, n, col) => c + ":" + Math.max(1, Number(n) - 2) + ":" + col)).join("\n") : formatar(e);
  mandar("erro", (e && e.name && !String(msg).startsWith(e.name) ? e.name + ": " : "") + msg + "\n");
  if (e && e.code === "MODULE_NOT_FOUND" && /npm install/.test(e.message)) mandar("info", "Dica: rode o npm install que a mensagem sugere e depois rode o programa de novo.\n");
  fim(1);
};
self.addEventListener("unhandledrejection", (ev) => { ev.preventDefault(); erroFatal(ev.reason); });
self.addEventListener("error", (ev) => { ev.preventDefault(); erroFatal(ev.error || ev.message); });

// ---- a ordem de rodar
const preparar = async (m) => {
  ARQUIVOS = { ...m.arquivos }; CWD = m.cwd || "/"; ENTRADA = String(m.entrada || "").split("\n"); if (ENTRADA[ENTRADA.length - 1] === "") ENTRADA.pop();
  self.process.argv = ["node", m.arquivo || "[eval]", ...(m.args || [])]; self.process.env = { ...(m.env || {}) };
  let versoes = {};
  try { versoes = JSON.parse(ARQUIVOS["/package.json"] || "{}").dependencies || {}; } catch {}
  await carregarPacotes(versoes);
};
// o modo interativo: as declarações viram globais (let/const no começo da linha viram var)
const ESCOPO = {};
onmessage = async (e) => {
  const m = e.data;
  if (m.tipo === "rodar") {
    try {
      await preparar(m);
      if (m.codigo !== undefined) {
        const require = criarRequire(CWD + "/[eval]");
        const corpo = m.imprimir ? "return (" + m.codigo + ")" : paraCommonJS(m.codigo);
        const r = await new Assincrona("module", "exports", "require", "__filename", "__dirname", corpo)({ exports: {} }, {}, require, "[eval]", CWD);
        if (m.imprimir) console.log(r);
      } else {
        const module = { exports: {} };
        cache.set(m.arquivo, module);
        const f = new Assincrona("module", "exports", "require", "__filename", "__dirname", paraCommonJS(ARQUIVOS[m.arquivo]) + "\n//# sourceURL=" + m.arquivo);
        await f(module, module.exports, criarRequire(m.arquivo), m.arquivo, pastaDe(m.arquivo));
      }
      // como o Node: espera os timers que ficaram
      const esperar = () => (vivos.size ? st(esperar, 40) : (stdin.emit("end"), (ouvintes.exit || []).forEach((f) => { try { f(self.process.exitCode); } catch {} }), fim(self.process.exitCode || 0)));
      esperar();
    } catch (err) { erroFatal(err); }
  } else if (m.tipo === "repl") {
    try {
      if (m.preparar) await preparar(m);
      let codigo = String(m.linha).replace(/^\s*(let|const)\s+/gm, "var ");
      codigo = /^\s*class\s+([\w$]+)/.test(codigo) ? codigo.replace(/^\s*class\s+([\w$]+)/, "var $1 = class $1") : codigo;
      self.require = criarRequire(CWD + "/[repl]");
      let r;
      if (/\bawait\b/.test(codigo)) {
        try { r = await (0, eval)("(async () => (" + codigo.replace(/;\s*$/, "") + "))()"); }
        catch (err) { if (err && err.name === "SyntaxError") r = await (0, eval)("(async () => { " + codigo + " })()"); else throw err; }
      } else r = (0, eval)(codigo);
      if (r && typeof r.then === "function") r = await r;
      if (r !== undefined) mandar("saida", formatar(r, false) + "\n");
      postMessage({ tipo: "repl-ok", mudou: [...MUDOU.entries()] });
    } catch (err) {
      if (err && err.name === "SyntaxError" && /end of input|Unterminated|missing \) |Unexpected end/i.test(err.message)) postMessage({ tipo: "repl-mais" });
      else { if (!(err instanceof SaidaDoProcesso)) mandar("erro", (err && err.name ? err.name + ": " : "") + (err && err.message || err) + "\n"); postMessage({ tipo: "repl-ok", mudou: [...MUDOU.entries()] }); }
    }
  }
};
`;

/** As mudanças que o programa fez no "disco" voltam para o projeto. */
function aplicarMudancas(projeto, mudou = []) {
  let p = projeto;
  for (const [caminho, conteudo] of mudou) {
    try {
      if (conteudo === null) { if (ehArquivo(p, caminho)) p = remover(p, caminho); }
      else p = escrever(p, caminho, conteudo);
    } catch { /* um nome que o projeto não aceita fica só na memória do programa */ }
  }
  return p;
}

function rodarJs({ projeto, arquivo, codigo, imprimir, args, entrada, cwd, env, aoEscrever, sinal }) {
  return new Promise((resolver) => {
    const w = trabalhador(NODE_DO_NAVEGADOR);
    let saida = "", erro = "";
    const escrever_ = (tipo, texto) => { if (tipo === "erro") erro += texto; else saida += texto; aoEscrever?.(tipo === "erro" ? "erro" : tipo === "info" ? "info" : "saida", texto); };
    const fechar = (r) => { clearTimeout(limite); sinal?.removeEventListener?.("abort", parar); w.terminate(); resolver({ saida, erro, jaEscreveu: Boolean(aoEscrever), ...r }); };
    const parar = () => { escrever_("erro", "^C\n"); fechar({ status: 130 }); };
    const limite = setTimeout(() => { escrever_("erro", `\nO programa passou de ${TEMPO_DO_JS / 1000} s e foi parado (Ctrl+C para parar antes).\n`); fechar({ status: 124 }); }, TEMPO_DO_JS);
    sinal?.addEventListener?.("abort", parar);
    w.onmessage = (e) => {
      const m = e.data || {};
      if (m.tipo === "saida" || m.tipo === "erro" || m.tipo === "info") escrever_(m.tipo, m.texto);
      else if (m.tipo === "fim") fechar({ status: m.status || 0, projeto: m.mudou?.length ? aplicarMudancas(projeto, m.mudou) : undefined });
    };
    w.onerror = (e) => { e.preventDefault?.(); escrever_("erro", `${e.message || "erro no JavaScript"}\n`); fechar({ status: 1 }); };
    w.postMessage({ tipo: "rodar", arquivos: projeto.arquivos, arquivo, codigo, imprimir, args, entrada, cwd, env });
  });
}

// ================================================================== Python (Pyodide)

const PYTHON_DO_NAVEGADOR = String.raw`
importScripts("${PYODIDE}pyodide.js");
let py = null, prontoPy = null, instalados = new Set();
const mandar = (tipo, texto) => postMessage({ tipo, texto });
async function carregar() {
  if (!prontoPy) prontoPy = (async () => {
    py = await loadPyodide({ indexURL: "${PYODIDE}" });
    py.setStdout({ batched: (t) => mandar("saida", t + "\n") });
    py.setStderr({ batched: (t) => mandar("erro", t + "\n") });
    py.runPython(String.raw` + "`" + String.raw`
import sys, io, builtins, os, code, traceback
os.makedirs("/home/pyodide/projeto", exist_ok=True)
_entrada_original = builtins.input
def _input(pergunta=""):
    sys.stdout.write(str(pergunta)); sys.stdout.flush()
    linha = sys.stdin.readline()
    if not linha:
        print()
        raise EOFError("a entrada acabou (o terminal pede as linhas antes de rodar; ou use: python programa.py < entrada.txt)")
    linha = linha.rstrip("\n")
    print(linha)
    return linha
builtins.input = _input
_repl = code.InteractiveConsole(locals={"__name__": "__main__"})
` + "`" + String.raw`);
  })();
  return prontoPy;
}
const RAIZ = "/home/pyodide/projeto";
function gravarProjeto(arquivos) {
  const fs = py.FS;
  const apagar = (d) => { for (const n of fs.readdir(d)) { if (n === "." || n === "..") continue; const c = d + "/" + n; if (fs.isDir(fs.stat(c).mode)) { apagar(c); fs.rmdir(c); } else fs.unlink(c); } };
  try { apagar(RAIZ); } catch {}
  for (const [c, t] of Object.entries(arquivos)) {
    const partes = c.split("/").filter(Boolean); partes.pop();
    let d = RAIZ; for (const p of partes) { d += "/" + p; try { fs.mkdir(d); } catch {} }
    fs.writeFile(RAIZ + c, t);
  }
}
function lerProjeto() {
  const fs = py.FS, achados = {};
  const descer = (d, rel) => { for (const n of fs.readdir(d)) { if (n === "." || n === ".." || n === "__pycache__") continue; const c = d + "/" + n; const st = fs.stat(c); if (fs.isDir(st.mode)) descer(c, rel + "/" + n); else if (st.size <= 200000) { try { achados[rel + "/" + n] = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFile(c)); } catch {} } } };
  descer(RAIZ, "");
  return achados;
}
async function instalar(pacotes) {
  await py.loadPackage("micropip");
  const micropip = py.pyimport("micropip");
  for (const p of pacotes) {
    if (instalados.has(p)) continue;
    mandar("info", "Instalando " + p + "…\n");
    await micropip.install(p);
    instalados.add(p);
  }
}
onmessage = async (e) => {
  const m = e.data;
  try {
    if (!py) mandar("info", "Abrindo o Python (só na primeira vez demora uns segundos)…\n");
    await carregar();
    if (m.tipo === "pip") {
      const [sub, ...resto] = m.args || [];
      if (sub === "install") {
        const nomes = resto.filter((a) => !a.startsWith("-") && a !== "-r");
        const arq = resto.includes("-r") ? resto[resto.indexOf("-r") + 1] : null;
        const lista = arq ? String(m.arquivos["/" + arq.replace(/^\/+/, "")] || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : nomes;
        if (!lista.length) { mandar("erro", "pip: diga o pacote (pip install requests)\n"); return postMessage({ tipo: "fim", status: 1 }); }
        await instalar(lista);
        mandar("saida", "Pronto: " + lista.join(", ") + " instalado(s).\n");
      } else if (sub === "list" || sub === "freeze") {
        await py.loadPackage("micropip");
        const lista = py.pyimport("micropip").list().toJs();
        const nomes = [...lista.keys()].sort();
        mandar("saida", (sub === "list" ? "Pacote              Versão\n-------------------- ----------\n" : "") + nomes.map((n) => sub === "list" ? n.padEnd(20) + " " + lista.get(n).version : n + "==" + lista.get(n).version).join("\n") + "\n");
      } else if (sub === "--version" || sub === "-V") mandar("saida", "pip (micropip do Pyodide)\n");
      else mandar("saida", "Comandos do pip: pip install pacote · pip install -r requirements.txt · pip list · pip freeze\n");
      return postMessage({ tipo: "fim", status: 0 });
    }
    if (m.tipo === "rodar") {
      gravarProjeto(m.arquivos);
      if (m.arquivos["/requirements.txt"]) {
        const req = m.arquivos["/requirements.txt"].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
        if (req.some((r) => !instalados.has(r))) await instalar(req);
      }
      const codigo = m.codigo !== undefined ? m.codigo : m.arquivos[m.arquivo];
      await py.loadPackagesFromImports(codigo, { messageCallback: (t) => /Loading|Loaded/.test(t) ? mandar("info", t.replace(/^Loading /, "Carregando ").replace(/^Loaded /, "Carregado: ") + "\n") : null, errorCallback: () => {} });
      py.globals.set("_proof", py.toPy({ arquivo: m.arquivo ? RAIZ + m.arquivo : null, codigo: m.codigo ?? null, args: m.args || [], entrada: m.entrada || "", cwd: RAIZ + (m.cwd === "/" ? "" : m.cwd || ""), raiz: RAIZ }));
      const status = await py.runPythonAsync(String.raw` + "`" + String.raw`
import sys, io, os, runpy, traceback
os.chdir(_proof["cwd"])
sys.stdin = io.StringIO(_proof["entrada"])
sys.argv = [_proof["arquivo"].replace(_proof["raiz"] + "/", "") if _proof["arquivo"] else "-c", *_proof["args"]]
if _proof["raiz"] not in sys.path: sys.path.insert(0, _proof["raiz"])
pasta = os.path.dirname(_proof["arquivo"]) if _proof["arquivo"] else _proof["cwd"]
if pasta not in sys.path: sys.path.insert(0, pasta)
for nome in [n for n, mod in list(sys.modules.items()) if getattr(mod, "__file__", "") and str(getattr(mod, "__file__", "")).startswith(_proof["raiz"])]:
    del sys.modules[nome]
_status = 0
try:
    if _proof["arquivo"]:
        runpy.run_path(_proof["arquivo"], run_name="__main__")
    else:
        exec(compile(_proof["codigo"], "<string>", "exec"), {"__name__": "__main__"})
except SystemExit as e:
    _status = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    if e.code not in (None, 0) and not isinstance(e.code, int): print(e.code, file=sys.stderr)
except BaseException:
    tipo, valor, tb = sys.exc_info()
    quadros = [q for q in traceback.extract_tb(tb) if "runpy" not in q.filename and "_pyodide" not in q.filename and "<exec>" not in q.filename]
    if quadros:
        print("Traceback (most recent call last):", file=sys.stderr)
        for q in traceback.format_list(quadros): print(q.rstrip().replace(_proof["raiz"] + "/", ""), file=sys.stderr)
    print("".join(traceback.format_exception_only(tipo, valor)).rstrip(), file=sys.stderr)
    _status = 1
sys.stdout.flush(); sys.stderr.flush()
_status
` + "`" + String.raw`);
      const depois = lerProjeto();
      const mudou = [];
      for (const [c, t] of Object.entries(depois)) if (m.arquivos[c] !== t) mudou.push([c, t]);
      for (const c of Object.keys(m.arquivos)) if (!(c in depois)) mudou.push([c, null]);
      return postMessage({ tipo: "fim", status: Number(status) || 0, mudou });
    }
    if (m.tipo === "repl") {
      if (m.preparar) { gravarProjeto(m.arquivos); py.runPython("import os, sys\nos.chdir('" + RAIZ + "')\nsys.path.insert(0, '" + RAIZ + "')"); }
      if (m.linha && /^\s*(import|from)\s/.test(m.linha)) await py.loadPackagesFromImports(m.linha, { messageCallback: () => {}, errorCallback: () => {} });
      py.globals.set("_linha", m.linha);
      const mais = py.runPython("import sys, io\nsys.stdin = io.StringIO('')\n_repl.push(_linha)");
      return postMessage({ tipo: mais ? "repl-mais" : "repl-ok" });
    }
  } catch (err) {
    mandar("erro", String(err && err.message || err).split("\n").filter((l) => !/^\s+at |pyodide\.asm/.test(l)).slice(-8).join("\n") + "\n");
    postMessage({ tipo: m.tipo === "repl" ? "repl-ok" : "fim", status: 1 });
  }
};
`;

let python = null; // o Worker do Python fica vivo (o Pyodide é grande; os pacotes do pip ficam instalados)
function workerDoPython() {
  if (!python) python = trabalhador(PYTHON_DO_NAVEGADOR);
  return python;
}
function reiniciarPython() { python?.terminate(); python = null; }

function conversarComPython(mensagem, { aoEscrever, sinal, limite = TEMPO_DO_PYTHON, projeto }) {
  return new Promise((resolver) => {
    const w = workerDoPython();
    let saida = "", erro = "";
    const escrever_ = (tipo, texto) => { if (tipo === "erro") erro += texto; else if (tipo === "saida") saida += texto; aoEscrever?.(tipo, texto); };
    const fechar = (r) => { clearTimeout(relogio); sinal?.removeEventListener?.("abort", parar); w.removeEventListener("message", ouvir); resolver({ saida, erro, jaEscreveu: Boolean(aoEscrever), ...r }); };
    const parar = () => { reiniciarPython(); escrever_("erro", "^C\nKeyboardInterrupt (o Python reinicia; os pacotes do pip voltam sozinhos se estiverem no requirements.txt)\n"); fechar({ status: 130 }); };
    const relogio = limite ? setTimeout(() => { reiniciarPython(); escrever_("erro", `\nO programa passou de ${limite / 1000} s e foi parado.\n`); fechar({ status: 124 }); }, limite) : null;
    sinal?.addEventListener?.("abort", parar);
    const ouvir = (e) => {
      const m = e.data || {};
      if (m.tipo === "saida" || m.tipo === "erro" || m.tipo === "info") escrever_(m.tipo, m.texto);
      else if (m.tipo === "fim") fechar({ status: m.status || 0, projeto: m.mudou?.length && projeto ? aplicarMudancas(projeto, m.mudou) : undefined });
      else if (m.tipo === "repl-ok" || m.tipo === "repl-mais") fechar({ status: 0, mais: m.tipo === "repl-mais" });
    };
    w.addEventListener("message", ouvir);
    w.onerror = (e) => { e.preventDefault?.(); reiniciarPython(); escrever_("erro", "Não consegui abrir o Python — confira a internet e tente de novo.\n"); fechar({ status: 1 }); };
    w.postMessage(mensagem);
  });
}

// ================================================================== SQL (SQLite)

const SQLITE_DO_NAVEGADOR = String.raw`
importScripts("${SQLJS}sql-wasm.js");
const pronto = initSqlJs({ locateFile: (f) => "${SQLJS}" + f });
let db = null, cabecalhos = true, modo = "table";
const mandar = (tipo, texto) => postMessage({ tipo, texto });
const bytesDe = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64De = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const tabela = (r) => {
  const cols = r.columns, linhas = r.values.map((l) => l.map((v) => v === null ? "NULL" : v instanceof Uint8Array ? "<blob " + v.length + " bytes>" : String(v)));
  if (modo === "csv") return [cabecalhos ? cols.join(",") : null, ...linhas.map((l) => l.map((v) => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(","))].filter((x) => x !== null).join("\n");
  if (modo === "list") return [cabecalhos ? cols.join("|") : null, ...linhas.map((l) => l.join("|"))].filter((x) => x !== null).join("\n");
  if (modo === "line") return linhas.map((l) => cols.map((c, i) => c.padStart(Math.max(...cols.map((x) => x.length))) + " = " + l[i]).join("\n")).join("\n\n");
  const larg = cols.map((c, i) => Math.max(cabecalhos ? c.length : 0, ...linhas.map((l) => l[i].length)));
  const linha = (l) => "│ " + l.map((x, i) => x.padEnd(larg[i])).join(" │ ") + " │";
  const sep = (a, b, c) => a + larg.map((w) => "─".repeat(w + 2)).join(b) + c;
  return [sep("┌", "┬", "┐"), ...(cabecalhos ? [linha(cols), sep("├", "┼", "┤")] : []), ...linhas.map(linha), sep("└", "┴", "┘")].join("\n");
};
const executar = (sql) => {
  const resultados = db.exec(sql);
  for (const r of resultados) mandar("saida", tabela(r) + "\n" + (r.values.length > 1 ? "(" + r.values.length + " linhas)\n" : ""));
  const mudou = db.getRowsModified();
  if (!resultados.length && mudou) mandar("info", "(" + mudou + " linha(s) alterada(s))\n");
};
const ponto = (linha, arquivos) => {
  const [cmd, ...a] = linha.trim().split(/\s+/);
  if (cmd === ".tables") { const r = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"); mandar("saida", (r[0] ? r[0].values.map((v) => v[0]).join("  ") : "") + "\n"); }
  else if (cmd === ".schema") { const r = db.exec("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL" + (a[0] ? " AND tbl_name = '" + a[0].replace(/'/g, "''") + "'" : "")); mandar("saida", (r[0] ? r[0].values.map((v) => v[0] + ";").join("\n") : "") + "\n"); }
  else if (cmd === ".headers") cabecalhos = a[0] !== "off";
  else if (cmd === ".mode") { if (["table", "box", "list", "csv", "line"].includes(a[0])) modo = a[0] === "box" ? "table" : a[0]; else mandar("erro", "modos: table, list, csv, line\n"); }
  else if (cmd === ".read") { const t = arquivos[a[0] && a[0].startsWith("/") ? a[0] : "/" + (a[0] || "")]; if (t === undefined) mandar("erro", "não achei " + a[0] + "\n"); else executar(t); }
  else if (cmd === ".dump") { const r = db.exec("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL"); mandar("saida", "BEGIN TRANSACTION;\n" + (r[0] ? r[0].values.map((v) => v[0] + ";").join("\n") : "") + "\nCOMMIT;\n"); }
  else if (cmd === ".help") mandar("saida", ".tables · .schema [tabela] · .headers on|off · .mode table|list|csv|line · .read arquivo.sql · .dump · .quit\n");
  else mandar("erro", "comando desconhecido: " + cmd + " (.help mostra os comandos)\n");
};
onmessage = async (e) => {
  const m = e.data;
  try {
    const SQL = await pronto;
    if (m.tipo === "abrir") { db = m.banco ? new SQL.Database(bytesDe(m.banco)) : new SQL.Database(); return postMessage({ tipo: "ok" }); }
    if (m.tipo === "sql") {
      if (m.sql.trim().startsWith(".")) ponto(m.sql, m.arquivos || {}); else executar(m.sql);
      return postMessage({ tipo: "ok", banco: m.guardar ? b64De(db.export()) : null });
    }
  } catch (err) {
    mandar("erro", "Erro: " + String(err && err.message || err) + "\n");
    postMessage({ tipo: "ok", status: 1, banco: m.guardar && db ? b64De(db.export()) : null });
  }
};
`;

/** Um banco SQLite aberto (o modo interativo e cada "sqlite3 banco.db"). */
function abrirBanco(conteudoDoArquivo) {
  const w = trabalhador(SQLITE_DO_NAVEGADOR);
  let fila = Promise.resolve();
  const pedir = (msg, aoEscrever) => (fila = fila.then(() => new Promise((resolver) => {
    let saida = "", erro = "";
    w.onmessage = (e) => {
      const m = e.data || {};
      if (m.tipo === "saida" || m.tipo === "erro" || m.tipo === "info") { if (m.tipo === "erro") erro += m.texto; else saida += m.texto; aoEscrever?.(m.tipo, m.texto); }
      else resolver({ saida, erro, status: m.status || (erro ? 1 : 0), banco: m.banco, jaEscreveu: Boolean(aoEscrever) });
    };
    w.onerror = (e) => { e.preventDefault?.(); resolver({ saida, erro: "Não consegui carregar o SQLite — confira a internet.\n", status: 1, jaEscreveu: false }); };
    w.postMessage(msg);
  })));
  const b64 = conteudoDoArquivo && conteudoDoArquivo.startsWith(MARCA_DO_BANCO) ? conteudoDoArquivo.slice(MARCA_DO_BANCO.length) : null;
  pedir({ tipo: "abrir", banco: b64 });
  return { pedir, fechar: () => w.terminate() };
}

function guardarBanco(projeto, caminho, b64) {
  if (!caminho || !b64) return projeto;
  const conteudo = MARCA_DO_BANCO + b64;
  if (conteudo.length > IDE.maxTamanhoDoArquivo) return projeto; // grande demais para o projeto: fica só nesta sessão
  try { return escrever(projeto, caminho, conteudo); } catch { return projeto; }
}

async function rodarSql({ projeto, banco, sql, aoEscrever }) {
  const b = abrirBanco(banco ? projeto.arquivos[banco] : null);
  try {
    const r = await b.pedir({ tipo: "sql", sql: String(sql ?? ""), arquivos: projeto.arquivos, guardar: Boolean(banco) }, aoEscrever);
    return { ...r, projeto: banco ? guardarBanco(projeto, banco, r.banco) : undefined };
  } finally { b.fechar(); }
}

// ================================================================== o compilador on-line

const DADOS = /\.(txt|csv|json|dat|in|tsv|xml|yaml|yml|md)$/i;
const FAMILIA = {
  c: /\.(c|h)$/i, cpp: /\.(c|cc|cpp|cxx|h|hpp|hh)$/i, java: /\.java$/i, go: /\.go$/i, rust: /\.rs$/i, csharp: /\.cs$/i, typescript: /\.(ts|js|json)$/i,
  python: /\.py$/i, ruby: /\.rb$/i, php: /\.php$/i, lua: /\.lua$/i, shell: /\.sh$/i, perl: /\.(pl|pm)$/i, haskell: /\.hs$/i, elixir: /\.(ex|exs)$/i,
  scala: /\.scala$/i, julia: /\.jl$/i, nim: /\.nim$/i, zig: /\.zig$/i, pascal: /\.pas$/i, ocaml: /\.ml$/i, groovy: /\.groovy$/i, crystal: /\.cr$/i, d: /\.d$/i, r: /\.r$/i, swift: /\.swift$/i,
};

/** Os outros arquivos que vão junto: os da mesma linguagem e os de dados, relativos à pasta do principal. */
function arquivosJunto(projeto, principal, chave, fontes = []) {
  const pasta = pastaDe(principal);
  const familia = FAMILIA[chave] || /$^/;
  const lista = [];
  let total = 0;
  for (const [c, conteudo] of Object.entries(projeto.arquivos)) {
    if (c === principal || conteudo.startsWith(IDE.marcaDeBinario) || conteudo.startsWith(MARCA_DO_BANCO)) continue;
    if (!familia.test(c) && !DADOS.test(c) && !fontes.includes(c)) continue;
    if (!c.startsWith(pasta === "/" ? "/" : pasta + "/")) continue;
    total += conteudo.length;
    if (lista.length >= 60 || total > 400_000) break;
    lista.push({ file: c.slice(pasta === "/" ? 1 : pasta.length + 1), code: conteudo });
  }
  return lista;
}

async function rodarNoCompilador({ projeto, linguagem, arquivo, fontes = [], args = [], entrada, soCompilar, opcoes = [], aoEscrever, sinal }) {
  const chave = linguagem.chave;
  const codes = arquivosJunto(projeto, arquivo, chave, fontes);
  const pasta = pastaDe(arquivo);
  // C e C++: os outros .c/.cpp da compilação entram na linha do compilador
  const outrasFontes = (fontes.length ? fontes : []).filter((f) => f !== arquivo).map((f) => f.slice(pasta === "/" ? 1 : pasta.length + 1));
  const opcoesDoCompilador = [
    ...(soCompilar && (chave === "c" || chave === "cpp") ? ["-fsyntax-only"] : []),
    ...((chave === "c" || chave === "cpp") ? outrasFontes : []),
    ...opcoes,
  ];
  aoEscrever?.("info", soCompilar ? `compilando ${nomeDe(arquivo)} no compilador on-line…\n` : "");
  const pedido = criar("/api/ide/rodar", {
    compilador: linguagem.compilador, chave, nome: nomeDe(arquivo), codigo: projeto.arquivos[arquivo] ?? "", arquivos: codes,
    opcoes: opcoesDoCompilador, argumentos: args, entrada: soCompilar ? "" : entrada,
  });
  const cancelado = new Promise((resolver) => sinal?.addEventListener?.("abort", () => resolver(null)));
  const resposta = await Promise.race([pedido, cancelado]).catch((e) => ({ falha: e }));
  if (resposta === null) return { saida: "", erro: "^C\n", status: 130 };
  if (resposta?.falha) return { saida: "", erro: `${resposta.falha.message || "não consegui falar com o compilador on-line"}\n`, status: 1 };
  const r = resposta.resultado;
  const mostrar = (tipo, texto) => { if (texto) aoEscrever?.(tipo, texto.endsWith("\n") ? texto : texto + "\n"); };
  if (soCompilar) {
    const falhou = r.falhouNaCompilacao || (chave === "c" || chave === "cpp" ? Boolean(r.compilacao && /error/i.test(r.compilacao)) : r.falhouNaCompilacao);
    mostrar(falhou ? "erro" : "aviso", r.compilacao);
    return { saida: "", erro: falhou ? (r.compilacao || "a compilação falhou") + "\n" : "", status: falhou ? 1 : 0, jaEscreveu: Boolean(aoEscrever) };
  }
  mostrar(r.falhouNaCompilacao ? "erro" : "aviso", r.compilacao);
  mostrar("saida", r.saida);
  mostrar("erro", r.erro);
  if (r.sinal) mostrar("erro", `O programa foi interrompido (${r.sinal}).`);
  const status = r.falhouNaCompilacao ? 1 : r.status ?? (r.erro ? 1 : 0);
  return { saida: r.saida || "", erro: [r.falhouNaCompilacao ? r.compilacao : "", r.erro].filter(Boolean).join("\n"), status, jaEscreveu: Boolean(aoEscrever) };
}

// ================================================================== a porta de entrada (o ctx.rodar do shell)

/** O `rodar` do shell: decide o executor pelo pedido. */
export async function rodarPedido(pedido) {
  const { tipo } = pedido;
  if (tipo === "pip") {
    return conversarComPython({ tipo: "pip", args: pedido.args, arquivos: pedido.projeto.arquivos }, { aoEscrever: pedido.aoEscrever, sinal: pedido.sinal, limite: 300_000 });
  }
  if (tipo === "sql") return rodarSql(pedido);
  if (tipo === "compilar") return rodarNoCompilador({ ...pedido, arquivo: pedido.fontes[0], soCompilar: true });
  if (tipo === "programa") {
    if (pedido.executor === "js") return rodarJs({ ...pedido, env: { USER: "aluno", HOME: "/" } });
    if (pedido.executor === "python") {
      return conversarComPython(
        { tipo: "rodar", arquivos: pedido.projeto.arquivos, arquivo: pedido.arquivo, codigo: pedido.codigo, args: pedido.args, entrada: pedido.entrada, cwd: pedido.cwd },
        { aoEscrever: pedido.aoEscrever, sinal: pedido.sinal, projeto: pedido.projeto },
      );
    }
    if (pedido.executor === "servidor") {
      if (!pedido.arquivo) return { saida: "", erro: "esta linguagem precisa de um arquivo para rodar\n", status: 1 };
      return rodarNoCompilador(pedido);
    }
  }
  return { saida: "", erro: "não sei rodar isto\n", status: 1 };
}

// ================================================================== os modos interativos

/**
 * Um modo interativo (node, python, sqlite3). `enviar(linha)` → { mais } (mais = a linha ainda não fechou o comando).
 * As mudanças que ele faz nos arquivos chegam por `aoMudarProjeto`.
 */
export function abrirModoInterativo(linguagem, { projeto, banco, cwd, aoEscrever, aoMudarProjeto }) {
  if (linguagem === "javascript") {
    const w = trabalhador(NODE_DO_NAVEGADOR);
    let primeira = true, pendente = "";
    // o bloco que não fechou (function f() {) junta as linhas e vai inteiro quando fechar
    const enviar = (linha) => new Promise((resolver) => {
      const codigo = pendente ? `${pendente}\n${linha}` : linha;
      w.onmessage = (e) => {
        const m = e.data || {};
        if (m.tipo === "saida" || m.tipo === "erro" || m.tipo === "info") aoEscrever(m.tipo, m.texto);
        else if (m.tipo === "repl-ok" || m.tipo === "repl-mais") {
          if (m.mudou?.length) aoMudarProjeto?.((p) => aplicarMudancas(p, m.mudou));
          pendente = m.tipo === "repl-mais" ? codigo : "";
          resolver({ mais: m.tipo === "repl-mais" });
        }
      };
      w.postMessage({ tipo: "repl", linha: codigo, preparar: primeira, arquivos: projeto().arquivos, cwd, entrada: "", args: [] });
      primeira = false;
    });
    return { prompt: "> ", promptMais: "... ", titulo: "Node (JavaScript do navegador). .help mostra os comandos; Ctrl+D ou .exit sai.", enviar, fechar: () => w.terminate(), especiais: { ".help": ".exit sai · .clear limpa · as variáveis ficam vivas entre as linhas · await funciona direto" } };
  }
  if (linguagem === "python") {
    let primeira = true;
    const enviar = async (linha) => {
      const r = await conversarComPython({ tipo: "repl", linha, preparar: primeira, arquivos: projeto().arquivos }, { aoEscrever, limite: 0 });
      primeira = false;
      return { mais: Boolean(r.mais) };
    };
    return { prompt: ">>> ", promptMais: "... ", titulo: "Python 3 (Pyodide, no navegador). Ctrl+D ou exit() sai; pip install funciona no terminal.", enviar, fechar: () => {} };
  }
  if (linguagem === "sql") {
    const b = abrirBanco(banco ? projeto().arquivos[banco] : null);
    let pendente = "";
    const enviar = async (linha) => {
      if (!pendente && linha.trim().startsWith(".")) {
        if (/^\.(quit|exit)\b/.test(linha.trim())) return { sair: true };
        await b.pedir({ tipo: "sql", sql: linha, arquivos: projeto().arquivos, guardar: false }, aoEscrever);
        return { mais: false };
      }
      pendente += (pendente ? "\n" : "") + linha;
      if (!sqlCompleto(pendente)) return { mais: Boolean(pendente.trim()) };
      const sql = pendente; pendente = "";
      const r = await b.pedir({ tipo: "sql", sql, arquivos: projeto().arquivos, guardar: Boolean(banco) }, aoEscrever);
      if (banco && r.banco) aoMudarProjeto?.((p) => guardarBanco(p, banco, r.banco));
      return { mais: false };
    };
    return { prompt: "sqlite> ", promptMais: "   ...> ", titulo: `SQLite${banco ? ` — ${nomeDe(banco)} (guardado no projeto)` : " — banco na memória"}. .help mostra os comandos; .quit sai.`, enviar, fechar: () => b.fechar() };
  }
  throw new Error("modo interativo desconhecido");
}

/** O comando SQL fechou? (termina com ; fora de aspas e de comentário) */
export function sqlCompleto(sql) {
  let aspas = null, ultimo = "";
  const t = String(sql).replace(/--[^\n]*/g, "");
  for (const c of t) {
    if (aspas) { if (c === aspas) aspas = null; continue; }
    if (c === "'" || c === "\"") { aspas = c; continue; }
    if (!/\s/.test(c)) ultimo = c;
  }
  return !aspas && ultimo === ";";
}

export { linguagemDoArquivo, extensaoDe, normalizarCaminho };

/** Para os testes (scripts/ide-check.mjs): o código que roda dentro dos Workers. */
export const CODIGO_DOS_TRABALHADORES = { node: NODE_DO_NAVEGADOR, python: PYTHON_DO_NAVEGADOR, sqlite: SQLITE_DO_NAVEGADOR };
