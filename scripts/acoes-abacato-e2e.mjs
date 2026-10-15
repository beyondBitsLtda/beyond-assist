// Ações da Lisa no Abacato, de ponta a ponta: Gemini de verdade + banco de verdade, num quadro
// temporário que é apagado no fim. Só EXECUTA ações que apontem para o quadro temporário.
// Uso (na raiz do beyond-assist):
//   node --env-file=.env --env-file=Abacatosys/abacato/.env.local --import ./scripts/alias-loader.mjs <este arquivo>
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();
const imp = (p) => import(pathToFileURL(path.join(raiz, p)).href);
const { tratarAcaoNoAbacato } = await imp("src/lib/fluxoDeAcoesNoAbacato.js");
const { esquecerCache } = await imp("src/lib/liveQuadros.js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let falhas = 0;
const conferir = (t, ok, d = "") => { console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}${d ? `  — ${d}` : ""}`); if (!ok) falhas++; };
const sufixo = Math.random().toString(36).slice(2, 7);
const NOME = `Teste ações Lisa ${sufixo}`;
let usuarioId, quadroId;
const colunas = {};
const cards = {};

const EMAIL = "Assunto: Indicação da equipe de atendimento sobre a presença digital da Imóveis Pro. Olá, Ricardo. A equipe de atendimento notou que os clientes chegam pelo Instagram procurando imóveis que já foram vendidos. Sugerimos revisar os anúncios toda segunda-feira e responder as mensagens em até duas horas. Fico à disposição. Brayan.";

async function rodar(pergunta, { history = {}, pendente = null } = {}) {
  esquecerCache();
  return tratarAcaoNoAbacato({ pergunta, history, pendente, quadroPadrao: NOME });
}
const doTeste = (p) => (p?.coluna_id ? Object.values(colunas).includes(p.coluna_id) : Object.values(cards).includes(p?.card_id));

try {
  // ---------------------------------------------------------------- preparo
  const { data: u, error: eu } = await db.from("abacato_usuarios").insert({
    email: `teste-acoes-${sufixo}@exemplo.invalid`, nome: "Teste Ações", senha_hash: "x", senha_sal: "x", ativo: true, aprovado: true, tipo: "interno",
  }).select("id").single();
  if (eu) throw eu;
  usuarioId = u.id;
  const { data: q, error: eq } = await db.from("abacato_quadros").insert({ nome: NOME, dono_id: usuarioId }).select("id").single();
  if (eq) throw eq;
  quadroId = q.id;
  for (const [i, nome] of ["A fazer", "Fazendo", "Feito"].entries()) {
    const { data } = await db.from("abacato_colunas").insert({ quadro_id: quadroId, nome, posicao: (i + 1) * 1024 }).select("id").single();
    colunas[nome] = data.id;
  }
  for (const [i, titulo] of ["Conferir o backup da madrugada", "Relatório mensal de vendas", "Relatório mensal de custos", "Card de teste para excluir"].entries()) {
    const { data } = await db.from("abacato_cards").insert({ coluna_id: colunas["A fazer"], titulo, posicao: (i + 1) * 1024 }).select("id").single();
    cards[titulo] = data.id;
  }
  console.log(`\nQuadro temporário "${NOME}" pronto\n`);

  // ---------------------------------------------------------------- 1. o print: criar com o texto sugerido
  const history = {
    turnos: [
      { papel: "voce", texto: "me sugere um e-mail para o CEO da Imóveis Pro sobre o atendimento" },
      { papel: "lisa", texto: EMAIL },
    ],
    ultimaResposta: EMAIL,
  };
  let r = await rodar("Você consegue criar um card lá no abacate exatamente com esse texto que você vai sugerir?", { history });
  conferir("frase do print → propõe criar card", r.respondeu && r.pending?.acao === "criar", `${r.texto}`);
  conferir("a descrição é o e-mail inteiro da resposta anterior", r.pending?.descricao === EMAIL);
  conferir("pede confirmação antes de gravar", /Confirma\?$/.test(r.texto || ""));
  if (r.pending?.acao === "criar" && doTeste(r.pending)) {
    const ok = await rodar("pode criar", { history, pendente: r.pending });
    const { data: novo } = await db.from("abacato_cards").select("titulo, descricao, origem").eq("coluna_id", r.pending.coluna_id).eq("origem", "lisa").maybeSingle();
    conferir("\"pode criar\" grava o card no Abacato", ok.texto.startsWith("Pronto") && novo?.descricao === EMAIL, `${ok.texto} | título: ${novo?.titulo}`);
  } else {
    conferir("o card proposto cai no quadro temporário (quadro padrão)", false, `coluna_id=${r.pending?.coluna_id} destino=${r.pending?.destino}`);
  }

  // ---------------------------------------------------------------- 2. concluir
  r = await rodar("marca o card de conferir o backup da madrugada como concluído");
  conferir("concluir → propõe com o card certo", r.pending?.acao === "concluir" && r.pending?.card_id === cards["Conferir o backup da madrugada"], r.texto);
  if (doTeste(r.pending)) {
    const ok = await rodar("sim", { pendente: r.pending });
    const { data } = await db.from("abacato_cards").select("concluido").eq("id", cards["Conferir o backup da madrugada"]).single();
    conferir("\"sim\" conclui no banco", data.concluido === true, ok.texto);
  }

  // ---------------------------------------------------------------- 3. prazo
  r = await rodar("muda o prazo do relatório mensal de vendas para o dia 30 de outubro");
  conferir("prazo → propõe editar com a data", r.pending?.acao === "editar" && r.pending?.prazo?.startsWith("2026-10-30"), `${r.texto} | prazo=${r.pending?.prazo}`);
  if (doTeste(r.pending)) {
    await rodar("isso mesmo", { pendente: r.pending });
    const { data } = await db.from("abacato_cards").select("fim_em").eq("id", r.pending.card_id).single();
    conferir("o prazo grava 30/10 às 23:59 em Brasília (não 29 às 21h)", data.fim_em?.startsWith("2026-10-31T02:59:59"), data.fim_em);
  }

  // ---------------------------------------------------------------- 4. mover
  r = await rodar("move o relatório mensal de vendas para Fazendo");
  conferir("mover → propõe a coluna Fazendo do mesmo quadro", r.pending?.acao === "mover" && r.pending?.coluna_id === colunas.Fazendo, r.texto);
  if (doTeste({ card_id: r.pending?.card_id })) {
    await rodar("sim", { pendente: r.pending });
    const { data } = await db.from("abacato_cards").select("coluna_id").eq("id", r.pending.card_id).single();
    conferir("\"sim\" move no banco", data.coluna_id === colunas.Fazendo);
  }

  // ---------------------------------------------------------------- 5. ambíguo
  r = await rodar(`conclui o relatório mensal do quadro ${NOME}`);
  const perguntou = r.pending?.type === "abacato_escolha" && r.pending.candidatos.length >= 2;
  conferir("pedido ambíguo → pergunta qual dos relatórios", perguntou, r.texto);
  if (perguntou) {
    const escolha = await rodar("o de custos", { pendente: r.pending });
    conferir("\"o de custos\" → propõe concluir o relatório de custos", escolha.pending?.acao === "concluir" && escolha.pending?.card_id === cards["Relatório mensal de custos"], escolha.texto);
  }

  // ---------------------------------------------------------------- 6. excluir e cancelar
  r = await rodar("exclui o card de teste para excluir");
  conferir("excluir → propõe arquivar, avisando que dá para recuperar", r.pending?.acao === "arquivar" && r.texto.includes("arquivado"), r.texto);
  const cancelou = await rodar("não, deixa", { pendente: r.pending });
  const { data: aindaLa } = await db.from("abacato_cards").select("arquivado").eq("id", cards["Card de teste para excluir"]).single();
  conferir("\"não\" cancela e não mexe em nada", cancelou.texto.includes("não mudei") && aindaLa.arquivado === false);
  r = await rodar("exclui o card de teste para excluir");
  if (doTeste(r.pending)) {
    await rodar("pode", { pendente: r.pending });
    const { data } = await db.from("abacato_cards").select("arquivado").eq("id", cards["Card de teste para excluir"]).single();
    conferir("\"pode\" arquiva no banco", data.arquivado === true);
  }

  // ---------------------------------------------------------------- 7. não é ação
  r = await rodar("quais tarefas eu tenho no quadro de testes?");
  conferir("pergunta comum não vira ação", !r.respondeu);
} catch (e) {
  falhas++;
  console.log(`\n  PAROU: ${e.message || e}\n`);
} finally {
  if (quadroId) await db.from("abacato_quadros").delete().eq("id", quadroId);
  if (usuarioId) await db.from("abacato_usuarios").delete().eq("id", usuarioId);
  const { count } = await db.from("abacato_quadros").select("id", { count: "exact", head: true }).eq("nome", NOME);
  conferir("quadro e conta temporários apagados", count === 0);
  console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
  process.exit(falhas ? 1 : 0);
}
