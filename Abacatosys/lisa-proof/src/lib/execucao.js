// O "Rodar" do exercício, a parte do servidor: leva o código das linguagens que não rodam no
// navegador (C, Python, PHP, Java...) ao Wandbox (wandbox.org), um compilador on-line gratuito.
// A regra de qual linguagem vai para onde mora em src/dominio/execucao.js.

import { ErroDeAcesso } from "./sessao.js";
import { execucaoDoExercicio, prepararParaCompilador, resultadoDoServidor, LIMITES_DO_RODAR } from "@/dominio/execucao.js";

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
