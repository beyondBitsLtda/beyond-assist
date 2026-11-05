// A prévia da página web da IDE livre (05/11/2026) e o .zip do projeto.
//
// A prévia é um <iframe sandbox> SEM allow-same-origin: a página roda numa origem opaca, sem acesso à conta da
// pessoa no Proof. O HTML vem do projeto com o CSS e o JavaScript embutidos (<link> e <script src> viram o conteúdo
// do arquivo), os módulos (import './x.js') viram data: URLs, o fetch de um arquivo do projeto ("dados.json")
// responde com o arquivo, e o console da página vai para o terminal (postMessage com a `chave` da prévia).

import { normalizarCaminho, pastaDe, extensaoDe, IDE } from "@/dominio/ide.js";
import { MARCA_DO_BANCO } from "./executores.js";

const b64 = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const TIPOS = { css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", svg: "image/svg+xml", html: "text/html", txt: "text/plain", csv: "text/csv", xml: "application/xml", md: "text/markdown" };
const ehTexto = (c) => !c.startsWith(IDE.marcaDeBinario) && !c.startsWith(MARCA_DO_BANCO);
const deFora = (url) => /^(https?:|data:|blob:|\/\/|#|mailto:)/i.test(url);

/** O módulo com os imports relativos trocados pelo data: URL de cada arquivo (recursivo, sem ciclo). */
function moduloComoData(projeto, caminho, pilha = []) {
  if (pilha.includes(caminho) || pilha.length > 12) return null;
  const codigo = projeto.arquivos[caminho];
  if (codigo === undefined) return null;
  const trocado = trocarImports(projeto, codigo, pastaDe(caminho), [...pilha, caminho]);
  return `data:text/javascript;base64,${b64(trocado)}`;
}
function trocarImports(projeto, codigo, pasta, pilha) {
  const troca = (esp) => {
    if (!/^\.{0,2}\//.test(esp)) return esp;
    const alvo = normalizarCaminho(pasta, esp);
    const c = [alvo, `${alvo}.js`, `${alvo}.mjs`, `${alvo}/index.js`].find((x) => projeto.arquivos[x] !== undefined);
    return (c && moduloComoData(projeto, c, pilha)) || esp;
  };
  return String(codigo)
    .replace(/(\bfrom\s*)(['"])([^'"]+)\2/g, (_, a, q, esp) => `${a}${q}${troca(esp)}${q}`)
    .replace(/(\bimport\s*)(['"])([^'"]+)\2/g, (_, a, q, esp) => `${a}${q}${troca(esp)}${q}`)
    .replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2/g, (_, a, q, esp) => `${a}${q}${troca(esp)}${q}`);
}

const PONTE = (chave, arquivos) => `<script>(function(){
var CHAVE=${JSON.stringify(chave)},ARQ=${JSON.stringify(arquivos).replace(/<\/script/gi, "<\\/script")};
function txt(x){if(typeof x==="string")return x;if(x instanceof Error)return x.name+": "+x.message;try{return JSON.stringify(x)}catch(e){return String(x)}}
function m(t,a){try{parent.postMessage({origem:"proof-previa",chave:CHAVE,tipo:t,texto:[].map.call(a,txt).join(" ")},"*")}catch(e){}}
["log","info","debug","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){m(k==="error"?"erro":k==="warn"?"aviso":"saida",arguments);return o.apply(console,arguments)}});
addEventListener("error",function(e){m("erro",[(e.message||"erro")+(e.lineno?" (linha "+e.lineno+")":"")])});
addEventListener("unhandledrejection",function(e){m("erro",["Promise: "+txt(e.reason)])});
var f=window.fetch;window.fetch=function(u,o){var s=String(u&&u.url||u);if(!/^[a-z]+:|^\\/\\//i.test(s)){var c=s.replace(/^\\.\\//,"").replace(/^\\//,"").split("?")[0];if(ARQ[c]!==undefined)return Promise.resolve(new Response(ARQ[c],{status:200,headers:{"content-type":/\\.json$/i.test(c)?"application/json":"text/plain"}}));return Promise.resolve(new Response("não achei "+s+" no projeto",{status:404}))}return f.apply(this,arguments)};
})();</script>`;

/** O HTML da prévia (srcdoc), com o projeto embutido. `chave` identifica as mensagens desta prévia. */
export function montarPrevia(projeto, caminhoHtml, chave) {
  const html = projeto.arquivos[caminhoHtml] ?? "";
  const pasta = pastaDe(caminhoHtml);
  const resolver = (url) => normalizarCaminho(pasta, url.split(/[?#]/)[0]);
  // os arquivos de texto, para o fetch relativo (relativos à pasta da página)
  const textos = {};
  let total = 0;
  for (const [c, t] of Object.entries(projeto.arquivos)) {
    if (!ehTexto(t) || total > 600_000) continue;
    const rel = pasta === "/" ? c.slice(1) : c.startsWith(pasta + "/") ? c.slice(pasta.length + 1) : null;
    if (rel) { textos[rel] = t; total += t.length; }
  }
  let saida = html
    // <link rel="stylesheet" href="estilo.css"> → <style>
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (!href || deFora(href) || !/stylesheet/i.test(tag)) return tag;
      const css = projeto.arquivos[resolver(href)];
      return css === undefined ? `<!-- não achei ${href} no projeto -->` : `<style data-arquivo="${href}">\n${css}\n</style>`;
    })
    // <script src="app.js"></script> → <script> com o código (módulo: os imports viram data: URLs)
    .replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
      if (deFora(src)) return tag;
      const c = resolver(src);
      const js = projeto.arquivos[c];
      if (js === undefined) return `<script>console.error("não achei ${src} no projeto")</script>`;
      const modulo = /type\s*=\s*["']module["']/i.test(a + b);
      const codigo = modulo ? trocarImports(projeto, js, pastaDe(c), [c]) : js;
      return `<script${a}${b} data-arquivo="${src}">\n${codigo.replace(/<\/script/gi, "<\\/script")}\n</script>`;
    })
    // módulos escritos direto na página também importam os arquivos do projeto
    .replace(/(<script\b[^>]*type\s*=\s*["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (tag, a, codigo, b) => (/data-arquivo/.test(a) ? tag : a + trocarImports(projeto, codigo, pasta, [caminhoHtml]) + b))
    // <img src="logo.svg"> e outros .svg do projeto → data: URL
    .replace(/(\b(?:src|href)\s*=\s*["'])([^"']+\.svg)(["'])/gi, (tag, a, url, b) => {
      if (deFora(url)) return tag;
      const svg = projeto.arquivos[resolver(url)];
      return svg === undefined ? tag : `${a}data:image/svg+xml;base64,${b64(svg)}${b}`;
    });
  const ponte = PONTE(chave, textos);
  if (/<head[^>]*>/i.test(saida)) saida = saida.replace(/<head[^>]*>/i, (h) => h + ponte);
  else saida = ponte + saida;
  return saida;
}

// ------------------------------------------------------------------ o .zip (sem compressão, o formato "store")

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** O projeto num .zip (Blob). Os executáveis do compilador on-line e os bancos ficam de fora (não são arquivos de verdade). */
export function zipDoProjeto(projeto) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let deslocamento = 0;
  const agora = new Date();
  const hora = ((agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1)) & 0xffff;
  const data = (((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate()) & 0xffff;
  const raiz = (projeto.nome || "projeto").replace(/[\\/:*?"<>|]+/g, "-");
  for (const [c, t] of Object.entries(projeto.arquivos)) {
    if (!ehTexto(t)) continue;
    const nome = enc.encode(`${raiz}${c}`);
    const dados = enc.encode(t);
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, hora, true); local.setUint16(12, data, true); local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true); local.setUint32(22, dados.length, true); local.setUint16(26, nome.length, true); local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, dados);
    const cab = new DataView(new ArrayBuffer(46));
    cab.setUint32(0, 0x02014b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 20, true); cab.setUint16(8, 0x0800, true); cab.setUint16(10, 0, true);
    cab.setUint16(12, hora, true); cab.setUint16(14, data, true); cab.setUint32(16, crc, true); cab.setUint32(20, dados.length, true); cab.setUint32(24, dados.length, true);
    cab.setUint16(28, nome.length, true); cab.setUint16(30, 0, true); cab.setUint16(32, 0, true); cab.setUint16(34, 0, true); cab.setUint16(36, 0, true);
    cab.setUint32(38, 0, true); cab.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(cab.buffer), nome);
    deslocamento += 30 + nome.length + dados.length;
  }
  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  const n = central.length / 2;
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, n, true); fim.setUint16(10, n, true);
  fim.setUint32(12, tamanhoCentral, true); fim.setUint32(16, deslocamento, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}

export const tipoDoArquivo = (caminho) => TIPOS[extensaoDe(caminho)] || "text/plain";
