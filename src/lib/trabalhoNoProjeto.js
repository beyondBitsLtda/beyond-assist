// A Lisa trabalhando num projeto do ProcessMap (01/11/2026), do lado do navegador: pedir o plano
// (/api/processmap/plano) e executá-lo — cada operação vira um desenho (/api/diagrama, com o projeto
// inteiro como contexto) salvo no projeto na hora. Usado pela conversa do Assistente e pela barra
// "pedir à Lisa" do painel ProcessMap ("de novo, ela só fez as anotações no primeiro fluxograma; ela
// deveria ir em todos os fluxogramas do projeto e todos os mapas mentais, aba por aba": a barra do
// painel só sabia mexer no fluxo aberto). Sem React: `buscar` e `api` vêm de fora (testado com
// servidor falso em scripts/fluxogramas-check.mjs).

import { contextoDoProjeto, arquivoDoDocumento } from "./processmapNaConversa.js";
import { descreverDiagrama } from "./diagramaDaLisa.js";

const JSON_ = { "content-type": "application/json" };

/** O plano do pedido sobre o projeto: { acao, explicacao, operacoes }. Lança se o servidor falhar. */
export async function pedirPlano({ pedido, projeto, fluxos, aberto = "", conversa = "", buscar = (...a) => fetch(...a) }) {
  const res = await buscar("/api/processmap/plano", {
    method: "POST",
    headers: JSON_,
    body: JSON.stringify({
      pedido,
      projeto: contextoDoProjeto(projeto, fluxos),
      fluxos: fluxos.map(({ id, nome, modo, formas }) => ({ id, nome, modo, formas })),
      aberto, conversa,
    }),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
  return r.plano;
}

const marca = (l) => (l.ok === true ? "✓" : l.ok === false ? "✗" : l.trabalhando ? "◆" : "◇");

/** O andamento em texto: a explicação do plano, uma linha por desenho e o fecho. */
export function textoDoAndamento(plano, linhas, fim = "") {
  return `${plano.explicacao ? `${plano.explicacao}\n\n` : ""}${linhas
    .map((l) => `${marca(l)} "${l.nome}" — ${l.estado}${l.nota ? `: ${l.nota}` : ""}`).join("\n")}${fim ? `\n\n${fim}` : ""}`;
}

/**
 * Executa o plano, uma operação por vez (o modelo e o banco agradecem), e devolve
 * { linhas, feitos, resultados: [{ op, fluxo (salvo), doc, colecao, explicacao, mudou }] }.
 *   docDe(fluxo): o documento de partida (o da tela, quando é o fluxo aberto — tem o que a pessoa
 *   acabou de mexer); `abertoId`: esse fluxo grava por cima (a versão da tela é a que vale).
 *   aoAndar(linhas): a cada passo, para a tela mostrar o andamento.
 */
export async function executarPlano({
  plano, projeto, fluxos, api, conversa = "", abertoId = "",
  docDe = (f) => f.documento, aoAndar = () => {}, buscar = (...a) => fetch(...a),
}) {
  const linhas = plano.operacoes.map((op) => ({
    nome: op.fluxo ? fluxos.find((f) => f.id === op.fluxo)?.nome || "?" : op.nome,
    estado: "na fila", ok: null, nota: "", trabalhando: false,
  }));
  const resultados = [];
  aoAndar(linhas);
  for (const [i, op] of plano.operacoes.entries()) {
    const linha = linhas[i];
    linha.estado = "trabalhando…";
    linha.trabalhando = true;
    aoAndar(linhas);
    try {
      const fluxo = op.fluxo ? fluxos.find((f) => f.id === op.fluxo) : null;
      const res = await buscar("/api/diagrama", {
        method: "POST",
        headers: JSON_,
        body: JSON.stringify({
          pedido: !fluxo && op.tipo === "mapa mental" ? `Monte um mapa mental. ${op.pedido}` : op.pedido,
          atual: fluxo ? docDe(fluxo) : null,
          conversa,
          projeto: contextoDoProjeto(projeto, fluxos, { alvo: fluxo }),
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
      // (origem "lisa": a versão de antes fica guardada — dá para voltar pelo painel ProcessMap)
      const daLisa = { documento: r.doc, origem: "lisa", motivo: String(op.pedido).replace(/\s+/g, " ").slice(0, 140) };
      const salvo = fluxo
        ? await api.salvar(fluxo.id, fluxo.id === abertoId ? { ...daLisa, forcar: true } : { ...daLisa, versao: fluxo.versao })
        : (await api.criar({ documento: r.doc, nome: op.nome || r.titulo, projetoId: projeto.id, origem: "lisa" })).fluxo;
      linha.nome = salvo.nome;
      linha.estado = fluxo ? "atualizado" : "criado";
      linha.ok = true;
      linha.nota = String(r.explicacao || "").split(/(?<=[.!?])\s/)[0].slice(0, 160);
      resultados.push({ op, fluxo: salvo, doc: r.doc, colecao: r.colecao, explicacao: r.explicacao, mudou: Boolean(fluxo) });
    } catch (err) {
      linha.estado = err.status === 409 ? "não salvei (mudou em outro lugar agora há pouco)" : "não deu";
      linha.nota = err.status === 409 ? "" : err.message;
      linha.ok = false;
    }
    linha.trabalhando = false;
    aoAndar(linhas);
  }
  return { linhas, feitos: resultados.length, resultados };
}

const tipoDe = (f) => (f.modo === "mindmap" || f.documento?.mode === "mindmap" ? "mapa mental" : "fluxograma");
const abasDoDesenho = (f) => (f.documento?.mode === "mindmap" ? 1 : f.documento?.pages?.length || 1);

/**
 * "Faça um MD por fluxograma e mapa mental" (01/11/2026): a Lisa escreve a visão geral do projeto e um
 * .md por desenho (/api/processmap/documento), `simultaneos` de cada vez. NENHUM desenho é mudado nem
 * salvo — só lidos. Devolve { linhas, documentos: [{ arquivo, markdown, legenda }] } (os que deram certo,
 * na ordem: visão geral, depois os desenhos); a página põe cada um numa aba do editor de código.
 */
export async function documentarProjeto({ pedido, projeto, fluxos, conversa = "", aoAndar = () => {}, buscar = (...a) => fetch(...a), simultaneos = 3 }) {
  const desenhos = fluxos.filter((f) => f.documento);
  const arquivos = desenhos.map((f, i) => ({ fluxo: f, arquivo: arquivoDoDocumento(projeto, f, i + 1), nome: f.nome, tipo: tipoDe(f) }));
  const visao = { fluxo: null, arquivo: arquivoDoDocumento(projeto, null, 0), nome: "Visão geral do projeto", tipo: "visão geral" };
  const tarefas = [visao, ...arquivos];
  const linhas = tarefas.map((t) => ({ nome: t.arquivo.split("/").pop(), estado: "na fila", ok: null, nota: "", trabalhando: false }));
  const documentos = new Array(tarefas.length).fill(null);
  const texto = contextoDoProjeto(projeto, fluxos);
  aoAndar(linhas);
  let proxima = 0;
  const trabalhar = async () => {
    while (proxima < tarefas.length) {
      const i = proxima++;
      const t = tarefas[i];
      const linha = linhas[i];
      linha.estado = "escrevendo…";
      linha.trabalhando = true;
      aoAndar(linhas);
      try {
        const res = await buscar("/api/processmap/documento", {
          method: "POST",
          headers: JSON_,
          body: JSON.stringify({
            pedido, conversa, projeto: texto, nomeDoProjeto: projeto.nome,
            ...(t.fluxo
              ? { desenho: { nome: t.nome, tipo: t.tipo, descricao: descreverDiagrama(t.fluxo.documento, { inteiro: true }) } }
              : { arquivos: arquivos.map(({ arquivo, nome, tipo }) => ({ arquivo, nome, tipo })) }),
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
        const abas = t.fluxo ? abasDoDesenho(t.fluxo) : 0;
        documentos[i] = {
          arquivo: t.arquivo,
          markdown: r.markdown,
          legenda: t.fluxo
            ? `**${linha.nome}** — "${t.nome}" (${t.tipo}${abas > 1 ? `, ${abas} abas` : ""}).`
            : `**${linha.nome}** — o conceito, a estratégia do MVP e a ordem de construção, apontando para os arquivos de cada desenho.`,
        };
        linha.estado = "escrito";
        linha.ok = true;
      } catch (err) {
        linha.estado = "não deu";
        linha.nota = err.message;
        linha.ok = false;
      }
      linha.trabalhando = false;
      aoAndar(linhas);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(simultaneos, tarefas.length)) }, trabalhar));
  return { linhas, documentos: documentos.filter(Boolean) };
}
