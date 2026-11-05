// O "Rodar" do exercício, a parte do servidor: leva o código das linguagens que não rodam no
// navegador (C, Python, PHP, Java...) ao Wandbox (wandbox.org), um compilador on-line gratuito.
// A regra de qual linguagem vai para onde mora em src/dominio/execucao.js.

import { ErroDeAcesso } from "./sessao.js";
import { execucaoDoExercicio, prepararParaCompilador, resultadoDoServidor, LIMITES_DO_RODAR } from "@/dominio/execucao.js";
import { COMPILADORES_DA_IDE } from "@/dominio/ide.js";

const WANDBOX = "https://wandbox.org/api/compile.json";

// Freio de boa-fé por pessoa, na memória de cada instância do Worker: não é uma cota exata, só
// evita que um laço de cliques (ou um script) martele o serviço gratuito de outra pessoa.
const usos = new Map();

function frear(usuarioId) {
  const agora = Date.now();
  const recentes = (usos.get(usuarioId) || []).filter((t) => agora - t < LIMITES_DO_RODAR.janelaMs);
  if (recentes.length >= LIMITES_DO_RODAR.porJanela) {
    throw new ErroDeAcesso(429, "muitas execuções seguidas — espere alguns minutos e rode de novo");
  }
  recentes.push(agora);
  usos.set(usuarioId, recentes);
}

export async function rodarNoServidor({ usuarioId, linguagem, tema, codigo, entrada }) {
  const exec = execucaoDoExercicio(linguagem, tema);
  if (!exec) throw new ErroDeAcesso(400, "esta linguagem ainda não roda no Proof");
  if (exec.onde !== "servidor") throw new ErroDeAcesso(400, `${exec.rotulo} roda no próprio navegador`);
  const texto = String(codigo ?? "");
  if (!texto.trim()) throw new ErroDeAcesso(400, "escreva algum código antes de rodar");
  if (texto.length > LIMITES_DO_RODAR.codigo) throw new ErroDeAcesso(400, "o código passou de 20 mil caracteres");
  frear(usuarioId);

  let resposta;
  try {
    resposta = await fetch(WANDBOX, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        compiler: exec.compilador,
        code: prepararParaCompilador(exec.chave, texto),
        stdin: String(entrada ?? "").slice(0, LIMITES_DO_RODAR.entrada),
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErroDeAcesso(504, "o compilador on-line demorou demais para responder — tente de novo");
  }
  if (!resposta.ok) throw new ErroDeAcesso(502, `o compilador on-line respondeu ${resposta.status} — tente de novo daqui a pouco`);
  const j = await resposta.json().catch(() => null);
  if (!j) throw new ErroDeAcesso(502, "o compilador on-line devolveu uma resposta que não deu para ler");
  return { ...resultadoDoServidor(j), rotulo: exec.rotulo, onde: "servidor" };
}

/**
 * A IDE livre (05/11/2026): o arquivo principal e os outros do projeto (cabeçalhos, módulos, dados) vão juntos ao
 * Wandbox, com as opções do compilador (os outros .c da compilação, -lm...) e os argumentos do programa. O
 * compilador tem de ser um dos da IDE (src/dominio/ide.js). O mesmo freio do Rodar do exercício vale aqui.
 */
export async function rodarNaIde({ usuarioId, compilador, chave, codigo, arquivos, opcoes, argumentos, entrada }) {
  if (!COMPILADORES_DA_IDE.has(compilador)) throw new ErroDeAcesso(400, "este compilador não está disponível na IDE");
  const texto = String(codigo ?? "");
  if (!texto.trim()) throw new ErroDeAcesso(400, "o arquivo está vazio");
  const outros = (Array.isArray(arquivos) ? arquivos : []).slice(0, 60)
    .filter((a) => a && typeof a.file === "string" && typeof a.code === "string" && /^[\w./ -]+$/.test(a.file) && !a.file.includes(".."))
    .map((a) => ({ file: a.file, code: a.code }));
  const total = texto.length + outros.reduce((s, a) => s + a.code.length, 0);
  if (total > 400_000) throw new ErroDeAcesso(400, "o projeto ficou grande demais para o compilador on-line (400 mil letras)");
  const limpar = (lista) => (Array.isArray(lista) ? lista : []).map(String).filter((o) => o && o.length <= 200 && !/[\n\r]/.test(o)).slice(0, 40);
  frear(usuarioId);

  let resposta;
  try {
    resposta = await fetch(WANDBOX, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        compiler: compilador,
        code: prepararParaCompilador(chave, texto),
        codes: outros,
        stdin: String(entrada ?? "").slice(0, LIMITES_DO_RODAR.entrada * 4),
        "compiler-option-raw": limpar(opcoes).join("\n"),
        "runtime-option-raw": limpar(argumentos).join("\n"),
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new ErroDeAcesso(504, "o compilador on-line demorou demais para responder — o programa tem um laço que não termina? Tente de novo");
  }
  if (!resposta.ok) throw new ErroDeAcesso(502, `o compilador on-line respondeu ${resposta.status} — tente de novo daqui a pouco`);
  const j = await resposta.json().catch(() => null);
  if (!j) throw new ErroDeAcesso(502, "o compilador on-line devolveu uma resposta que não deu para ler");
  return resultadoDoServidor(j);
}
