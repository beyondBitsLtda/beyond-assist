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
const { MARCA_DO_RASCUNHO, falaSemRascunho, pareceAcao, pendenteValida } = await imp("src/lib/acoesNoAbacato.js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let falhas = 0;
const conferir = (t, ok, d = "") => { console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}${d ? `  — ${d}` : ""}`); if (!ok) falhas++; };
const sufixo = Math.random().toString(36).slice(2, 7);
const NOME = `Teste ações Lisa ${sufixo}`;
let usuarioId, quadroId;
const colunas = {};
const cards = {};

const EMAIL = "Assunto: Indicação da equipe de atendimento sobre a presença digital da Imóveis Pro. Olá, Ricardo. A equipe de atendimento notou que os clientes chegam pelo Instagram procurando imóveis que já foram vendidos. Sugerimos revisar os anúncios toda segunda-feira e responder as mensagens em até duas horas. Fico à disposição. Brayan.";

// o "buscar" de /api/ask, com um contexto fixo no lugar da busca no índice
const SOBRE_A_BEYOND = [{ source: "BEYOND_BRAIN", board: "Notas", title: "Beyond Bits", content: "A Beyond Bits desenvolve sistemas sob medida para pequenas empresas: assistentes com IA (a Lisa), quadros de tarefas (Abacato) e automações. Atende imobiliárias e prestadores de serviço." }];
const buscar = async () => SOBRE_A_BEYOND;

// Pelo MESMO caminho de /api/ask: o filtro pareceAcao vem antes do módulo. Sem ele, o teste
// passava com "me ajuda a montar um card" enquanto a Lisa de verdade nem chegava ao módulo.
async function rodar(pergunta, { history = {}, pendente = null } = {}) {
  esquecerCache();
  const valida = pendenteValida(pendente);
  if (!pareceAcao(pergunta, !!valida)) return { respondeu: false, barradoNoFiltro: true };
  return tratarAcaoNoAbacato({ pergunta, history, pendente: valida, quadroPadrao: NOME, buscar });
}

// Uma conversa de várias mensagens, como o navegador faz: guarda as falas e a ação pendente
// (que só muda quando a Lisa responde por aqui — "fora" deixa a pendente como estava).
function novoPapo(turnos = []) {
  const estado = { turnos: [...turnos], pendente: null, ultima: turnos.filter((t) => t.papel === "lisa").at(-1)?.texto || "" };
  return {
    async dizer(texto) {
      const r = await rodar(texto, { history: { turnos: estado.turnos, ultimaResposta: estado.ultima }, pendente: estado.pendente });
      estado.turnos.push({ papel: "voce", texto });
      console.log(`         você: ${texto}\n         lisa: ${r.respondeu ? falaSemRascunho(r.texto).replace(/\n/g, " ").slice(0, 240) : "(resposta normal)"}`);
      if (r.respondeu) { estado.pendente = r.pending || null; estado.turnos.push({ papel: "lisa", texto: r.texto }); estado.ultima = r.texto; }
      return r;
    },
    // a resposta normal (fora do fluxo de ações), simulada
    lisa(texto, pendente) { estado.turnos.push({ papel: "lisa", texto }); estado.ultima = texto; estado.pendente = pendente; },
  };
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

  // ---------------------------------------------------------------- 1b. o print de 16/10 + montar conversando
  // A última resposta é sobre outro assunto (eleição): ela NÃO pode ir para o card. O card vira um
  // RASCUNHO: ela pergunta o que falta, escreve, ajusta, e só grava no "pode criar".
  const PIADA = "Minha programação é baseada em lógica, dados estruturados e eficiência algorítmica, e não em preferências partidárias ou cartões de filiação.";
  const papo = novoPapo([{ papel: "voce", texto: "em quem você votaria?" }, { papel: "lisa", texto: PIADA }]);
  r = await papo.dizer("cria um card com um pitch de vendas para a Beyond");
  conferir("pitch → abre um rascunho (não grava nem pede Confirma de cara)", r.respondeu && r.pending?.type === "abacato_rascunho" && r.pending.acao === "criar", r.texto?.slice(0, 160));
  conferir("o rascunho cai no quadro temporário (quadro padrão)", doTeste(r.pending));
  conferir("a resposta anterior (eleição) não entra no card", !String(r.pending?.descricao || "").includes("partidárias"));
  // responde às perguntas dela até ter texto (no máximo 3 rodadas)
  const respostas = [
    "é para donos de imobiliária pequena, tom direto e confiante, destaca o Abacato e a Lisa",
    "quero que eles marquem uma demonstração de 20 minutos",
    "pode escrever com o que você já tem",
  ];
  for (const resp of respostas) {
    if (r.pending?.descricao) break;
    r = await papo.dizer(resp);
  }
  const v1 = String(r.pending?.descricao || "");
  conferir("depois das respostas, o texto existe e é sobre a Beyond", v1.length > 150 && /beyond|abacato|lisa/i.test(v1), `${v1.length} letras`);
  conferir("a resposta mostra o card na tela, e a voz fala só a fala", r.texto.includes(MARCA_DO_RASCUNHO) && !falaSemRascunho(r.texto).includes(v1.slice(0, 60)), falaSemRascunho(r.texto).slice(0, 140));
  r = await papo.dizer("deixa bem mais curto, umas três frases, e põe prazo para sexta-feira");
  const v2 = String(r.pending?.descricao || "");
  conferir("ajuste: texto mais curto e prazo de sexta", v2.length > 0 && v2.length < v1.length && /^\d{4}-\d{2}-\d{2}/.test(r.pending?.prazo || ""), `${v1.length} → ${v2.length} letras, prazo=${r.pending?.prazo}`);
  const guardado = r.pending;
  r = await papo.dizer("aliás, quanto é 15% de 2400?");
  conferir("outro assunto no meio → resposta normal, rascunho fica guardado", !r.respondeu);
  papo.lisa("15% de 2400 é 360.", guardado);
  if (doTeste(guardado)) {
    r = await papo.dizer("perfeito, pode criar");
    const { data: criados } = await db.from("abacato_cards").select("titulo, descricao, fim_em").eq("coluna_id", guardado.coluna_id).eq("origem", "lisa");
    const novo = (criados || []).find((c) => c.descricao === v2);
    conferir("\"pode criar\" grava o card com o texto e o prazo do rascunho", r.texto?.startsWith("Pronto") && !!novo && !!novo.fim_em, `${r.texto} | ${novo?.titulo}`);
  }
  console.log(`\n      título: ${guardado?.titulo}\n      ${v2.slice(0, 400).replace(/\n/g, "\n      ")}\n`);

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

  // ---------------------------------------------------------------- 8. "me ajuda a montar" e desistir
  const papo2 = novoPapo();
  r = await papo2.dizer("me ajuda a montar um card para a reunião com o contador");
  conferir("\"me ajuda a montar um card\" → rascunho", r.pending?.type === "abacato_rascunho", r.texto?.slice(0, 160));
  r = await papo2.dizer("não, esquece esse card, deixa pra lá");
  conferir("desistir → nada gravado, rascunho fecha", r.respondeu && !r.pending && /deixei|não gravei/i.test(r.texto), r.texto);

  // ---------------------------------------------------------------- 9. melhorar o texto de um card que já existe
  const papo3 = novoPapo();
  r = await papo3.dizer("vamos melhorar a descrição do card Relatório mensal de vendas, quero um passo a passo de como montar o relatório");
  conferir("editar com texto → rascunho de editar no card certo", r.pending?.type === "abacato_rascunho" && r.pending.acao === "editar" && r.pending.card_id === cards["Relatório mensal de vendas"], r.texto?.slice(0, 160));
  for (const resp of ["os dados vêm do Abacato e de uma planilha de vendas, é para eu mesmo", "pode escrever"]) {
    if (r.pending?.descricao) break;
    r = await papo3.dizer(resp);
  }
  const passo = String(r.pending?.descricao || "");
  conferir("o rascunho de editar tem o passo a passo", passo.length > 80, `${passo.length} letras`);
  if (r.pending?.card_id === cards["Relatório mensal de vendas"]) {
    r = await papo3.dizer("ficou bom, pode salvar");
    const { data } = await db.from("abacato_cards").select("descricao").eq("id", cards["Relatório mensal de vendas"]).single();
    conferir("\"pode salvar\" grava a descrição no card", r.texto?.startsWith("Pronto") && data.descricao === passo, r.texto);
  }

  // ---------------------------------------------------------------- 10. o print de 21/10: "a estrutura que você acha ideal"
  // Virava um card VAZIO: o modelo punha o assunto no título e o "confirma" gravava sem texto.
  // Agora abre o rascunho e já escreve a proposta (pediu a opinião dela), sem interrogatório.
  const papo4 = novoPapo();
  r = await papo4.dizer("cria um card com a estrutura que você acha ideal pro perfil da Beyond no GitHub, descrevendo todo o texto seção por seção e os elementos gráficos");
  const proposta = String(r.pending?.descricao || "");
  conferir("\"a estrutura que você acha ideal\" → rascunho (não card vazio)", r.pending?.type === "abacato_rascunho" && r.pending.acao === "criar", r.texto?.slice(0, 160));
  conferir("a primeira resposta já traz o texto, seção por seção", proposta.length > 300 && (proposta.match(/\n/g) || []).length >= 4, `${proposta.length} letras`);
  const { count: nadaGravado } = await db.from("abacato_cards").select("id", { count: "exact", head: true }).eq("titulo", r.pending?.titulo || "-").eq("origem", "lisa");
  conferir("nada é gravado antes do \"pode criar\"", !nadaGravado);
  console.log(`\n      título: ${r.pending?.titulo}\n      ${proposta.slice(0, 700).replace(/\n/g, "\n      ")}\n`);

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
