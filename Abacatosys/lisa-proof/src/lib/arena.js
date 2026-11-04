// A Arena Lúdica de Programação no banco (03/11/2026, BEYOND-0023). O conteúdo e as regras moram em
// src/dominio/arena.js; a tabela é proof_arena (db/030).
//
// A tela roda os testes na hora, no navegador (rápido, para o retorno em tempo real). Para gravar a fase e pagar
// a recompensa, o servidor confere de novo: o Parsons aqui mesmo (é só comparar a ordem); a masmorra e o mascote
// rodando o mesmo arnês no Wandbox (Node 20), um compilador on-line — o código de ninguém roda no nosso servidor.
// A senha do arnês muda a cada conferência. A recompensa sai uma vez por fase (concluida_em marcado antes).

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { creditarMoedas } from "./reino.js";
import { registrarEvento, estudouHoje, depoisDePontuar, resultadoDaPontuacao } from "./estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { gerarJson, personaDo, temModelo } from "./ia.js";
import {
  JOGOS_DA_ARENA, ORDEM_DOS_JOGOS, FASES_DA_ARENA, ANDARES_DA_MASMORRA, BUGS, andarPorId, NIVEIS_DO_MASCOTE, nivelPorId,
  PUZZLES_DE_PARSONS, puzzlePorId, CODIGO_INICIAL_DO_MASCOTE, arnesDoBug, arnesDoMascote, lerArnes, testesParaTela,
  blocosEmbaralhados, conferirParsons, faseExiste, faseLiberada, PONTOS_DO_MINIGAME, chaveDoMinigame, jogoDoDia,
  LINGUAGENS_DO_PARSONS, LINGUAGEM_DOS_JOGOS, linguagensDoPlano,
} from "@/dominio/arena.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const WANDBOX = "https://wandbox.org/api/compile.json";
const NODE = "nodejs-20.17.0";
const LIMITE_DO_CODIGO = 12_000;

// freio de boa-fé por pessoa (como o do Rodar): não martelar o serviço gratuito dos outros
const usos = new Map();
function frear(usuarioId) {
  const agora = Date.now();
  const recentes = (usos.get(usuarioId) || []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length >= 20) throw new ErroDeAcesso(429, "muitas conferências seguidas — espere alguns minutos");
  recentes.push(agora);
  usos.set(usuarioId, recentes);
}

/** Roda o arnês no Node do Wandbox e lê o resultado (com a senha desta conferência). */
async function rodarNoNode(codigo, senha) {
  let resposta;
  try {
    resposta = await fetch(WANDBOX, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compiler: NODE, code: codigo }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ErroDeAcesso(504, "a conferência demorou demais — o código tem um laço que não termina? Tente de novo");
  }
  if (!resposta.ok) throw new ErroDeAcesso(502, `o conferidor on-line respondeu ${resposta.status} — tente de novo daqui a pouco`);
  const j = await resposta.json().catch(() => null);
  return { resultado: lerArnes(j?.program_output || "", senha), erro: String(j?.program_error || j?.compiler_error || "").slice(0, 1500) };
}

const senhaNova = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Tudo o que o minigame do dia precisa: os jogos, as fases (com o conteúdo), o progresso e os pontos de hoje. */
export async function arenaDe(usuarioId) {
  const hoje = diaDe();
  const [{ data, error }, { data: doDia }, { data: trilhas, error: eTrilhas }] = await Promise.all([
    supabase.from("proof_arena").select("jogo, fase, tentativas, acertos, melhor_tempo_ms, concluida_em, recompensa").eq("usuario_id", usuarioId),
    supabase.from("proof_eventos").select("pontos").eq("usuario_id", usuarioId).eq("chave", chaveDoMinigame(hoje)).maybeSingle(),
    supabase.from("proof_trilhas").select("tema, perfil, status").eq("usuario_id", usuarioId).order("criada_em", { ascending: false }),
  ]);
  falhou(error, "arena");
  // o plano de estudo: as linguagens das trilhas de programação (o Parsons vem nelas; sem nenhuma, o minigame avisa)
  // (as trilhas em curso; todas concluídas, vale o histórico. Se a leitura falhar, fica como antes: tudo liberado)
  const emCurso = (trilhas || []).filter((x) => x.status !== "concluida");
  const linguagens = eTrilhas ? ["javascript", "python"] : linguagensDoPlano(emCurso.length ? emCurso : trilhas || []);
  if (eTrilhas) console.warn("[arena] não leu as trilhas (o minigame fica sem o plano):", eTrilhas.message);
  const doPlano = linguagens.length ? linguagens : ["javascript"];
  const linhas = data || [];
  const porFase = new Map(linhas.map((l) => [`${l.jogo}:${l.fase}`, l]));
  const concluidas = new Set(linhas.filter((l) => l.concluida_em).map((l) => `${l.jogo}:${l.fase}`));
  const progresso = (jogo, fase) => {
    const l = porFase.get(`${jogo}:${fase}`);
    return { liberada: faseLiberada(jogo, fase, concluidas), concluida: Boolean(l?.concluida_em), tentativas: l?.tentativas || 0, melhorTempoMs: l?.melhor_tempo_ms ?? null };
  };
  const totalDeFases = ORDEM_DOS_JOGOS.reduce((s, j) => s + FASES_DA_ARENA[j].length, 0);
  return {
    jogos: ORDEM_DOS_JOGOS.map((id) => ({
      id, ...JOGOS_DA_ARENA[id], fases: FASES_DA_ARENA[id].length, concluidas: FASES_DA_ARENA[id].filter((f) => concluidas.has(`${id}:${f}`)).length,
      linguagem: LINGUAGEM_DOS_JOGOS[id], foraDoPlano: Boolean(LINGUAGEM_DOS_JOGOS[id]) && linguagens.length > 0 && !linguagens.includes(LINGUAGEM_DOS_JOGOS[id]),
    })),
    plano: { temProgramacao: linguagens.length > 0, linguagens: doPlano.map((chave) => ({ chave, nome: LINGUAGENS_DO_PARSONS[chave] })) },
    masmorra: ANDARES_DA_MASMORRA.map((a) => ({
      id: a.id, nome: a.nome, paleta: a.paleta, mapa: a.mapa, ...progresso("masmorra", a.id),
      bugs: a.bugs.map((b) => ({ id: b, nome: BUGS[b].nome, obstaculo: BUGS[b].obstaculo, tipo: BUGS[b].tipo, funcao: BUGS[b].funcao, enunciado: BUGS[b].enunciado, codigo: BUGS[b].codigo, dica: BUGS[b].dica, testes: testesParaTela(b) })),
    })),
    mascote: NIVEIS_DO_MASCOTE.map((n) => ({ ...n, codigoInicial: CODIGO_INICIAL_DO_MASCOTE, ...progresso("mascote", n.id) })),
    // cada quebra-cabeça nas linguagens do plano (a primeira é a de abertura)
    parsons: PUZZLES_DE_PARSONS.map((p) => ({
      id: p.id, titulo: p.titulo, enunciado: p.enunciado, linguagem: doPlano[0], ...progresso("parsons", p.id),
      blocos: blocosEmbaralhados(p.id, usuarioId, doPlano[0]),
      versoes: Object.fromEntries(doPlano.map((l) => {
        const v = puzzlePorId(p.id, l);
        return [l, { linguagem: v.linguagem, nota: v.nota, blocos: blocosEmbaralhados(p.id, usuarioId, l) }];
      })),
    })),
    resumo: { concluidas: concluidas.size, total: totalDeFases, moedas: linhas.reduce((s, l) => s + (l.recompensa || 0), 0) },
    doDia: jogoDoDia(hoje, linguagens.length ? linguagens : null),
    pontosDoDia: PONTOS_DO_MINIGAME,
    hoje: { feito: Boolean(doDia), pontos: doDia?.pontos || 0 },
  };
}

/**
 * Confere uma fase e grava o progresso. `codigos` (masmorra: { bugId: código }), `codigo` (mascote) ou
 * `resposta` (Parsons: [{ id, recuo }]); `tempoMs`: quanto a pessoa levou na fase. Venceu pela primeira vez,
 * a recompensa cai no saldo do reino.
 */
export async function conferirNaArena(usuarioId, { jogo, fase, codigos, codigo, resposta, tempoMs, linguagem }) {
  if (!faseExiste(jogo, fase)) throw new ErroDeAcesso(404, "essa fase não existe");
  const { data: feitas, error: e0 } = await supabase.from("proof_arena").select("jogo, fase, concluida_em").eq("usuario_id", usuarioId).not("concluida_em", "is", null);
  falhou(e0, "arena");
  if (!faseLiberada(jogo, fase, new Set((feitas || []).map((l) => `${l.jogo}:${l.fase}`)))) throw new ErroDeAcesso(400, "vença a fase anterior para liberar esta");

  let ok = false;
  let detalhe = {};
  if (jogo === "parsons") {
    // a resposta é conferida na linguagem em que a pessoa montou (a do plano dela)
    const r = conferirParsons(fase, resposta, LINGUAGENS_DO_PARSONS[linguagem] ? linguagem : null);
    ok = r.ok;
    detalhe = { certas: r.certas, total: r.total };
  } else {
    frear(usuarioId);
    const senha = senhaNova();
    if (jogo === "masmorra") {
      const andar = andarPorId(fase);
      const resultados = {};
      for (const bugId of andar.bugs) {
        const texto = String(codigos?.[bugId] ?? "");
        if (!texto.trim() || texto.length > LIMITE_DO_CODIGO) throw new ErroDeAcesso(400, "mande o código consertado de cada bug do andar");
        const r = await rodarNoNode(arnesDoBug(bugId, texto, senha), senha);
        resultados[bugId] = Boolean(r.resultado?.length && r.resultado.every((t) => t.ok));
      }
      ok = Object.values(resultados).every(Boolean);
      detalhe = { bugs: resultados };
    } else {
      const texto = String(codigo ?? "");
      if (!texto.trim() || texto.length > LIMITE_DO_CODIGO) throw new ErroDeAcesso(400, "mande a função decidir do mascote");
      const r = await rodarNoNode(arnesDoMascote(fase, texto, senha), senha);
      ok = Boolean(r.resultado?.venceu);
      detalhe = { motivo: r.resultado?.motivo || r.erro || "o código não rodou" };
    }
  }
  const gravado = await gravarTentativa(usuarioId, jogo, fase, ok, tempoMs);
  return { ok, ...detalhe, ...gravado, ...(ok ? await pontosDoMinigame(usuarioId, jogo, fase) : { pontosDoDia: 0 }) };
}

/**
 * Os pontos do minigame do dia: a primeira fase vencida no dia (qualquer jogo, fase nova ou repetida) vale
 * PONTOS_DO_MINIGAME, uma vez — contam para a meta, a ofensiva e as conquistas, como os do quiz.
 */
async function pontosDoMinigame(usuarioId, jogo, fase) {
  const estudavaAntes = await estudouHoje(usuarioId);
  const ganhou = await registrarEvento({
    usuarioId, trilhaId: null, tipo: "arena", chave: chaveDoMinigame(diaDe()), pontos: PONTOS_DO_MINIGAME,
    detalhe: { titulo: `Minigame do dia: ${JOGOS_DA_ARENA[jogo].nome}`, jogo, fase },
  });
  if (!ganhou) return { pontosDoDia: 0 };
  const extra = resultadoDaPontuacao(ganhou, await depoisDePontuar({ usuarioId, trilhaId: null, estudavaAntes, ganhou }));
  return { pontosDoDia: ganhou, pontuacao: extra };
}

/**
 * A jogada de um robô (a Lisa, src/lib/lisaRotina.js): a rotina decide se ela acertou (pela chance dela, como no
 * quiz) e a fase conta igual à de qualquer pessoa — tentativa, recompensa e os pontos do minigame do dia. Só
 * para contas de robô (proof_perfis.robo).
 */
export async function jogadaDoRobo(usuarioId, { jogo, fase, ok, tempoMs }) {
  const { data: perfil } = await supabase.from("proof_perfis").select("robo").eq("usuario_id", usuarioId).maybeSingle();
  if (!perfil?.robo) throw new ErroDeAcesso(403, "só os robôs jogam sem conferir");
  if (!faseExiste(jogo, fase)) throw new ErroDeAcesso(404, "essa fase não existe");
  const gravado = await gravarTentativa(usuarioId, jogo, fase, Boolean(ok), tempoMs);
  return { ok: Boolean(ok), ...gravado, ...(ok ? await pontosDoMinigame(usuarioId, jogo, fase) : { pontosDoDia: 0 }) };
}

/** Soma a tentativa e, na primeira vitória, conclui a fase e paga (uma vez só: concluida_em marcado antes). */
async function gravarTentativa(usuarioId, jogo, fase, ok, tempoMs) {
  const { data: atual, error } = await supabase.from("proof_arena").select("id, tentativas, acertos, melhor_tempo_ms, concluida_em")
    .eq("usuario_id", usuarioId).eq("jogo", jogo).eq("fase", fase).maybeSingle();
  falhou(error, "arena");
  const tempo = Number.isFinite(Number(tempoMs)) && Number(tempoMs) > 0 ? Math.min(86_400_000, Math.round(Number(tempoMs))) : null;
  const melhor = ok && tempo ? Math.min(tempo, atual?.melhor_tempo_ms ?? Infinity) : atual?.melhor_tempo_ms ?? null;
  const campos = { tentativas: (atual?.tentativas || 0) + 1, acertos: (atual?.acertos || 0) + (ok ? 1 : 0), melhor_tempo_ms: melhor, atualizado_em: new Date().toISOString() };
  let id = atual?.id;
  if (atual) {
    const { error: e2 } = await supabase.from("proof_arena").update(campos).eq("id", atual.id);
    falhou(e2, "arena");
  } else {
    const { data, error: e2 } = await supabase.from("proof_arena").upsert({ usuario_id: usuarioId, jogo, fase, ...campos }, { onConflict: "usuario_id,jogo,fase" }).select("id").single();
    falhou(e2, "arena");
    id = data.id;
  }
  if (!ok || atual?.concluida_em) return { recompensa: 0, primeiraVez: false };
  const valor = JOGOS_DA_ARENA[jogo].recompensa;
  const { data: marcado, error: e3 } = await supabase.from("proof_arena").update({ concluida_em: new Date().toISOString(), recompensa: valor }).eq("id", id).is("concluida_em", null).select("id");
  falhou(e3, "arena");
  if (!marcado?.length) return { recompensa: 0, primeiraVez: false };
  try {
    await creditarMoedas(usuarioId, "arena", valor, { jogo, fase });
  } catch (e) {
    await supabase.from("proof_arena").update({ concluida_em: null, recompensa: 0 }).eq("id", id);
    throw e;
  }
  return { recompensa: valor, primeiraVez: true };
}

/**
 * A Lisa explica o erro (o "feedback tratado pela IA"): o que a mensagem quer dizer e por onde olhar, sem
 * entregar o código consertado.
 */
export async function explicarNaArena(usuarioId, { jogo, fase, bug, codigo, erro }) {
  if (!faseExiste(jogo, fase)) throw new ErroDeAcesso(404, "essa fase não existe");
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
  const contexto = jogo === "masmorra" ? BUGS[bug]?.enunciado : jogo === "mascote" ? `${nivelPorId(fase)?.nome}: o mascote precisa comer tudo sem bater na parede nem cair na água; a função decidir(ver) devolve "andar", "virar-esquerda", "virar-direita" ou "comer".` : puzzlePorId(fase)?.enunciado;
  if (!contexto) throw new ErroDeAcesso(400, "diga qual desafio");
  const bruto = await gerarJson({
    sistema: personaDo("programacao") + " Aqui você é a tutora da Arena: explica o erro de forma curta e encorajadora, sem dar a resposta pronta.",
    esquema: { type: "OBJECT", properties: { explicacao: { type: "STRING" }, ondeOlhar: { type: "STRING" } }, required: ["explicacao", "ondeOlhar"] },
    maxTokens: 800,
    pedido: [
      `O desafio: ${contexto}`,
      "O código do estudante:",
      String(codigo ?? "").slice(0, 4000),
      "O que aconteceu ao rodar:",
      String(erro ?? "").slice(0, 1500),
      "",
      "Responda em português do Brasil:",
      "- `explicacao`: em 1 a 3 frases, o que esse erro (ou esse resultado errado) significa, em linguagem simples.",
      "- `ondeOlhar`: 1 ou 2 frases dizendo onde olhar no código e que pergunta se fazer. NÃO escreva o código consertado.",
    ].join("\n"),
  });
  return { explicacao: String(bruto?.explicacao || "").slice(0, 600), ondeOlhar: String(bruto?.ondeOlhar || "").slice(0, 400) };
}
