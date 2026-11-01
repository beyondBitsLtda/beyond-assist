// A Lisa trabalhando num projeto do ProcessMap (01/11/2026), do lado do navegador: pedir o plano
// (/api/processmap/plano) e executá-lo — cada operação vira um desenho (/api/diagrama, com o projeto
// inteiro como contexto) salvo no projeto na hora. Usado pela conversa do Assistente e pela barra
// "pedir à Lisa" do painel ProcessMap ("de novo, ela só fez as anotações no primeiro fluxograma; ela
// deveria ir em todos os fluxogramas do projeto e todos os mapas mentais, aba por aba": a barra do
// painel só sabia mexer no fluxo aberto). Sem React: `buscar` e `api` vêm de fora (testado com
// servidor falso em scripts/fluxogramas-check.mjs).

import { contextoDoProjeto, caminhoDoDocumento, documentosPorDesenho } from "./processmapNaConversa.js";
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
 *   aoAndar(linhas): a cada passo, para a tela mostrar o andamento. `contexto`: o código dos
 *   repositórios ligados à conversa ("a arquitetura do nosso produto" desenha o que existe de verdade).
 */
export async function executarPlano({
  plano, projeto, fluxos, api, conversa = "", contexto = "", abertoId = "",
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
          conversa, contexto,
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
 * Escreve os documentos do plano (/api/processmap/documento), `simultaneos` de cada vez. NENHUM desenho é
 * mudado nem salvo — só lidos. Cada documento: { arquivo, titulo, desenhos (ids), novos, pedido (o foco),
 * estilo }; `criados`: os fluxos que o plano acabou de criar (os documentos com `novos` falam deles —
 * "faça um fluxograma da arquitetura … e um md também"). `contexto`: o código dos repositórios ligados.
 * Devolve { linhas, documentos: [{ arquivo (docs/<projeto>/…), markdown, legenda }] } (os que deram
 * certo, na ordem do plano); a página põe cada um numa aba do editor de código.
 */
export async function escreverDocumentos({
  pedido, projeto, fluxos, documentos: pedidos, criados = [], conversa = "", contexto = "",
  aoAndar = () => {}, buscar = (...a) => fetch(...a), simultaneos = 3,
}) {
  const todos = [...fluxos, ...criados.filter((c) => !fluxos.some((f) => f.id === c.id))];
  const porId = new Map(todos.map((f) => [String(f.id), f]));
  const tarefas = pedidos.map((d) => {
    const base = [...d.desenhos.map((id) => porId.get(String(id))), ...(d.novos ? criados : [])].filter((f) => f?.documento);
    return { ...d, base: [...new Set(base)], caminho: caminhoDoDocumento(projeto, d.arquivo) };
  });
  // a visão geral aponta para os arquivos de cada desenho
  const deDesenho = tarefas.filter((t) => t.estilo === "especificacao").map((t) => ({ arquivo: t.arquivo, nome: t.base[0]?.nome || t.titulo, tipo: tipoDe(t.base[0] || {}) }));
  const linhas = tarefas.map((t) => ({ nome: t.arquivo, estado: "na fila", ok: null, nota: "", trabalhando: false }));
  const prontos = new Array(tarefas.length).fill(null);
  const texto = contextoDoProjeto(projeto, todos);
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
            pedido, conversa, contexto, projeto: texto, nomeDoProjeto: projeto.nome,
            foco: t.pedido, titulo: t.titulo, estilo: t.estilo,
            desenhos: t.base.map((f) => ({ nome: f.nome, tipo: tipoDe(f), descricao: descreverDiagrama(f.documento, { inteiro: true }) })),
            ...(t.estilo === "visao-geral" ? { arquivos: deDesenho } : {}),
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
        const um = t.base[0];
        const abas = um ? abasDoDesenho(um) : 0;
        prontos[i] = {
          arquivo: t.caminho,
          markdown: r.markdown,
          legenda: t.estilo === "visao-geral"
            ? `**${t.arquivo}** — o conceito, a estratégia do MVP e a ordem de construção, apontando para os arquivos de cada desenho.`
            : t.estilo === "especificacao" && um
              ? `**${t.arquivo}** — "${um.nome}" (${tipoDe(um)}${abas > 1 ? `, ${abas} abas` : ""}).`
              : `**${t.arquivo}** — ${t.titulo}${t.base.length ? ` (a partir de ${t.base.map((f) => `"${f.nome}"`).join(", ")})` : ""}.`,
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
  return { linhas, documentos: prontos.filter(Boolean) };
}

/**
 * "Faça um MD por fluxograma e mapa mental" (01/11/2026): a visão geral do projeto e um .md por desenho
 * (documentosPorDesenho) — o mesmo que escreverDocumentos com esses documentos.
 */
export function documentarProjeto({ fluxos, ...resto }) {
  const desenhos = fluxos.filter((f) => f.documento);
  return escreverDocumentos({ ...resto, fluxos, documentos: documentosPorDesenho(desenhos) });
}
