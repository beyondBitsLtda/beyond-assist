// O USO DOS USUÁRIOS DA LISA (04/11/2026: "quero poder ver o uso dos usuários dela" — quando entraram, quanto tempo
// ficaram e o que fizeram), para o painel do admin (/uso).
//
// Como o tempo é medido (o mesmo jeito do Lisa_Proof): com a aba da Lisa aberta e visível, a tela manda uma BATIDA
// por minuto para /api/presenca, com a tela em que a pessoa está. Cada batida soma o tempo desde a anterior (com teto:
// a aba que dormiu não conta o sono) e um minuto na tela. Uma pausa de mais de 5 minutos fecha o ACESSO e a próxima
// batida abre outro. O login também abre um. Nada do que a pessoa fala ou escreve é guardado aqui: só quando, quanto
// tempo, onde e o tipo de aparelho.
//
// "O que fizeram" sai do que a Lisa já conta: lisa_uso (perguntas, desenhos, comentários de tela e falas por dia — o
// admin não conta ali) e os fluxogramas criados no ProcessMap. A parte pura (sem banco) é testada em
// scripts/uso-check.mjs.

import { supabase } from "./supabase.js";
import { adminsDe } from "./authSession.js";

export const PRESENCA = { batidaSegundos: 60, pausaParaNovoAcesso: 300, tetoPorBatida: 90 };
export const PERIODOS_DO_USO = [7, 30, 90];

/** As telas da Lisa, pela primeira parte do caminho. */
export const TELAS = {
  assistant: "Assistente", fluxogramas: "ProcessMap", visual: "Visual da Lisa", "lisa-task": "Lisa Task",
  login: "Entrada", paineis: "Painéis do admin",
};

export function telaDoCaminho(caminho) {
  const primeira = String(caminho || "/").split("?")[0].split("/").filter(Boolean)[0] || "paineis";
  return Object.hasOwn(TELAS, primeira) ? primeira : "paineis";
}

export function aparelhoDe(agenteDoNavegador) {
  const ua = String(agenteDoNavegador || "");
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "celular";
  return "computador";
}

/** A batida sobre o acesso aberto: { segundos, paginas, ultimo }, ou null quando o acesso já fechou (abre outro). */
export function somarBatida(acesso, agora, tela, { semTempo = false } = {}) {
  if (!acesso) return null;
  const desde = (new Date(agora).getTime() - new Date(acesso.ultimo).getTime()) / 1000;
  if (!(desde >= 0) || desde > PRESENCA.pausaParaNovoAcesso) return null;
  const paginas = { ...(acesso.paginas || {}) };
  paginas[tela] = (paginas[tela] || 0) + 1;
  return {
    // a aba que voltou a ficar visível marca a presença, mas não conta o tempo em que ficou escondida
    segundos: (acesso.segundos || 0) + (semTempo ? 0 : Math.round(Math.min(desde, PRESENCA.tetoPorBatida))),
    paginas,
    ultimo: new Date(agora).toISOString(),
  };
}

export function duracaoLegivel(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** O que cada pessoa fez, no singular e no plural. */
export const ACOES = {
  pergunta: ["pergunta", "perguntas"], desenho: ["desenho", "desenhos"], tela: ["comentário de tela", "comentários de tela"],
  voz: ["fala", "falas"], fluxograma: ["fluxograma criado", "fluxogramas criados"],
};
export function contagemDaAcao(chave, quantas) {
  const [um, varios] = ACOES[chave] || [chave, chave];
  return `${quantas} ${quantas === 1 ? um : varios}`;
}

/**
 * O painel: uma linha por pessoa. Entradas (já filtradas pelo período):
 *   pessoas   [{ id, email, nome, admin, criadaEm, ultimoLogin }]
 *   acessos   [{ dono_id, inicio, ultimo, segundos, paginas, aparelho, entrou }]
 *   usos      [{ dono_id, dia, tipo, quantos }]          (lisa_uso)
 *   desenhos  [{ dono_id, criado_em }]                   (fluxogramas criados)
 */
export function resumoDoUso({ pessoas, acessos, usos, desenhos }) {
  const por = new Map(pessoas.map((p) => [p.id, {
    ...p, acessos: 0, logins: 0, segundos: 0, dias: new Set(), aparelhos: {}, telas: {}, acoes: {}, historico: [], ultimoAcesso: null,
  }]));
  for (const a of acessos) {
    const p = por.get(a.dono_id);
    if (!p) continue;
    p.acessos++;
    if (a.entrou) p.logins++;
    p.segundos += a.segundos || 0;
    if (!p.ultimoAcesso || a.ultimo > p.ultimoAcesso) p.ultimoAcesso = a.ultimo;
    p.dias.add(String(a.inicio).slice(0, 10));
    p.aparelhos[a.aparelho || "computador"] = (p.aparelhos[a.aparelho || "computador"] || 0) + 1;
    for (const [tela, minutos] of Object.entries(a.paginas || {})) p.telas[tela] = (p.telas[tela] || 0) + minutos;
    p.historico.push({ inicio: a.inicio, ultimo: a.ultimo, segundos: a.segundos || 0, aparelho: a.aparelho || "computador", entrou: Boolean(a.entrou),
      telas: Object.entries(a.paginas || {}).sort((x, y) => y[1] - x[1]).map(([t]) => TELAS[t] || t) });
  }
  for (const u of usos) {
    const p = por.get(u.dono_id);
    if (!p || !ACOES[u.tipo]) continue;
    p.acoes[u.tipo] = (p.acoes[u.tipo] || 0) + (Number(u.quantos) || 0);
    p.dias.add(String(u.dia).slice(0, 10));
  }
  for (const d of desenhos) {
    const p = por.get(d.dono_id);
    if (p) p.acoes.fluxograma = (p.acoes.fluxograma || 0) + 1;
  }
  const lista = [...por.values()].map((p) => {
    const ultimo = [p.ultimoAcesso, p.ultimoLogin].filter(Boolean).sort().at(-1) || null;
    return {
      id: p.id, email: p.email, nome: p.nome || "", admin: Boolean(p.admin), criadaEm: p.criadaEm || null, ultimoLogin: p.ultimoLogin || null,
      ultimoAcesso: ultimo, acessos: p.acessos, logins: p.logins, segundos: p.segundos, diasAtivos: p.dias.size,
      mediaPorAcesso: p.acessos ? Math.round(p.segundos / p.acessos) : 0,
      aparelho: Object.entries(p.aparelhos).sort((x, y) => y[1] - x[1])[0]?.[0] || null,
      telas: Object.entries(p.telas).sort((x, y) => y[1] - x[1]).map(([tela, minutos]) => ({ tela, rotulo: TELAS[tela] || tela, minutos })),
      acoes: Object.entries(p.acoes).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]).map(([chave, quantas]) => ({ chave, quantas, texto: contagemDaAcao(chave, quantas) })),
      totalDeAcoes: Object.values(p.acoes).reduce((s, n) => s + n, 0),
      historico: p.historico.sort((x, y) => (x.inicio < y.inicio ? 1 : -1)).slice(0, 20),
    };
  });
  lista.sort((a, b) => (Number(a.admin) - Number(b.admin)) || (b.ultimoAcesso || "").localeCompare(a.ultimoAcesso || "") || a.email.localeCompare(b.email));
  const usuarios = lista.filter((p) => !p.admin);
  const ativos = usuarios.filter((p) => p.acessos > 0 || p.totalDeAcoes > 0);
  return {
    totais: {
      pessoas: usuarios.length, ativas: ativos.length, acessos: ativos.reduce((s, p) => s + p.acessos, 0),
      segundos: ativos.reduce((s, p) => s + p.segundos, 0), acoes: ativos.reduce((s, p) => s + p.totalDeAcoes, 0),
    },
    pessoas: lista,
  };
}

// ---------------------------------------------------------------- o banco

/** A batida (ou o login, com `entrou`): soma no acesso aberto da pessoa ou abre um novo. Quem chama engole o erro. */
export async function registrarPresenca(dono, { caminho = "/", aparelho = "computador", entrou = false, voltou = false } = {}) {
  if (!dono) return;
  const tela = entrou ? "login" : telaDoCaminho(caminho);
  const agora = new Date();
  if (!entrou) {
    const { data: aberto, error } = await supabase.from("lisa_presenca").select("id, ultimo, segundos, paginas")
      .eq("dono_id", dono).order("ultimo", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`presença: ${error.message}`);
    const soma = somarBatida(aberto, agora, tela, { semTempo: voltou });
    if (soma) {
      const { error: e2 } = await supabase.from("lisa_presenca").update(soma).eq("id", aberto.id);
      if (e2) throw new Error(`presença: ${e2.message}`);
      return;
    }
  }
  const { error: e3 } = await supabase.from("lisa_presenca").insert({
    dono_id: dono, inicio: agora.toISOString(), ultimo: agora.toISOString(), segundos: 0,
    paginas: entrou ? {} : { [tela]: 1 }, aparelho, entrou,
  });
  if (e3) throw new Error(`presença: ${e3.message}`);
}

async function lerTudo(montar, onde) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw new Error(`${onde}: ${error.message}`);
    linhas.push(...(data || []));
    if (!data || data.length < 1000) return linhas;
  }
}

/** As contas do login da Lisa (Supabase Auth): e-mail, nome, criação e o último login. */
async function contasDaLisa() {
  const contas = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`contas: ${error.message}`);
    const lote = data?.users || [];
    contas.push(...lote);
    if (lote.length < 200) break;
  }
  return contas;
}

/** O painel do admin: quem entrou, quanto tempo ficou, onde e o que fez, nos últimos `dias`. */
export async function usoParaPainel(dias) {
  const periodo = PERIODOS_DO_USO.includes(Number(dias)) ? Number(dias) : PERIODOS_DO_USO[0];
  const desde = new Date(Date.now() - periodo * 86_400_000);
  const desdeIso = desde.toISOString();
  const desdeDia = desdeIso.slice(0, 10);
  const admins = new Set(adminsDe(process.env.LISA_ADMINS));
  const [contas, perfis, acessos, usos, desenhos] = await Promise.all([
    contasDaLisa(),
    lerTudo(() => supabase.from("lisa_perfis").select("dono_id, nome").order("dono_id"), "perfis").catch(() => []),
    lerTudo(() => supabase.from("lisa_presenca").select("dono_id, inicio, ultimo, segundos, paginas, aparelho, entrou").gte("ultimo", desdeIso).order("ultimo"), "presença"),
    lerTudo(() => supabase.from("lisa_uso").select("dono_id, dia, tipo, quantos").gte("dia", desdeDia).order("dia"), "uso").catch(() => []),
    lerTudo(() => supabase.from("lisa_fluxogramas").select("dono_id, criado_em").eq("origem", "pessoa").gte("criado_em", desdeIso).order("criado_em"), "fluxogramas").catch(() => []),
  ]);
  const nomes = new Map(perfis.map((p) => [p.dono_id, p.nome]));
  const pessoas = contas.map((c) => ({
    id: c.id, email: c.email || "", nome: nomes.get(c.id) || c.user_metadata?.nome || "",
    admin: admins.has(String(c.id).toLowerCase()) || c.app_metadata?.role === "admin",
    criadaEm: c.created_at || null,
    // o último login do autenticador vale mesmo antes da batida existir (e dentro do período)
    ultimoLogin: c.last_sign_in_at && c.last_sign_in_at >= desdeIso ? c.last_sign_in_at : null,
  }));
  const resumo = resumoDoUso({ pessoas, acessos, usos, desenhos });
  const { data: primeiro } = await supabase.from("lisa_presenca").select("inicio").order("inicio").limit(1).maybeSingle();
  return { periodo, periodos: PERIODOS_DO_USO, desde: desdeIso, medindoDesde: primeiro?.inicio || null, ...resumo };
}
