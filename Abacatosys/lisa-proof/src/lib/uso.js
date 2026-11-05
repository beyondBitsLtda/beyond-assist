// O uso do Proof no banco: a batida de presença (proof_acessos) e o painel do administrador. A regra (como a batida
// soma, as áreas, o resumo) está em src/dominio/uso.js.
import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { PRESENCA, PERIODOS_DO_USO, areaDoCaminho, somarBatida, resumoDoUso } from "@/dominio/uso.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };

/** O administrador do Proof é a conta do Abacato com o e-mail PROOF_ADMIN_EMAIL (o mesmo dos chamados). */
export function ehAdministrador(usuario) {
  const email = String(process.env.PROOF_ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(email && String(usuario?.email || "").trim().toLowerCase() === email);
}

/**
 * A batida de presença: soma no acesso aberto da pessoa ou abre um novo (no login, sempre um novo). Uma falha aqui
 * nunca derruba a tela de ninguém: quem chama engole o erro.
 */
export async function registrarPresenca(usuario, { caminho = "/", aparelho = "computador", entrou = false, voltou = false } = {}) {
  const area = entrou ? "entrar" : areaDoCaminho(caminho);
  const agora = new Date();
  if (!entrou) {
    const { data: aberto, error } = await supabase.from("proof_acessos").select("id, ultimo, segundos, paginas")
      .eq("usuario_id", usuario.id).order("ultimo", { ascending: false }).limit(1).maybeSingle();
    falhou(error, "acessos");
    const soma = somarBatida(aberto, agora, area, { semTempo: voltou });
    if (soma) {
      const { error: e2 } = await supabase.from("proof_acessos").update(soma).eq("id", aberto.id);
      falhou(e2, "acessos");
      return;
    }
  }
  const { error: e3 } = await supabase.from("proof_acessos").insert({
    usuario_id: usuario.id, inicio: agora.toISOString(), ultimo: agora.toISOString(), segundos: 0,
    paginas: entrou ? {} : { [area]: 1 }, aparelho, entrou,
  });
  falhou(e3, "acessos");
}

/** Lê tudo de uma consulta, de 1000 em 1000 (o teto do PostgREST). */
async function lerTudo(montar, onde) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    falhou(error, onde);
    linhas.push(...(data || []));
    if (!data || data.length < 1000) return linhas;
  }
}

/** O painel do uso (só o administrador): quem entrou, quanto tempo ficou, onde e o que fez, nos últimos `dias`. */
export async function usoParaTela(usuario, dias) {
  if (!ehAdministrador(usuario)) throw new ErroDeAcesso(403, "só o administrador do Proof vê o uso");
  const periodo = PERIODOS_DO_USO.includes(Number(dias)) ? Number(dias) : PERIODOS_DO_USO[0];
  const desde = new Date(Date.now() - periodo * 86_400_000).toISOString();
  const [pessoas, perfis, acessos, eventos, movimentos] = await Promise.all([
    lerTudo(() => supabase.from("abacato_usuarios").select("id, nome, email").eq("ativo", true).order("nome"), "pessoas"),
    lerTudo(() => supabase.from("proof_perfis").select("usuario_id, robo").order("usuario_id"), "perfis"),
    lerTudo(() => supabase.from("proof_acessos").select("usuario_id, inicio, ultimo, segundos, paginas, aparelho, entrou").gte("ultimo", desde).order("ultimo"), "acessos"),
    lerTudo(() => supabase.from("proof_eventos").select("usuario_id, tipo, pontos, criado_em").gte("criado_em", desde).order("criado_em"), "eventos"),
    lerTudo(() => supabase.from("proof_reino_movimentos").select("usuario_id, tipo, valor, criado_em").gte("criado_em", desde).order("criado_em"), "movimentos"),
  ]);
  const robos = new Set(perfis.filter((p) => p.robo).map((p) => p.usuario_id));
  // quem tem perfil no Proof (já entrou alguma vez) ou usou no período: as contas do Abacato que nunca abriram o Proof
  // ficam de fora, para a lista não virar a lista do Abacato inteiro
  const doProof = new Set([...perfis.map((p) => p.usuario_id), ...acessos.map((a) => a.usuario_id)]);
  const resumo = resumoDoUso({
    pessoas: pessoas.filter((p) => doProof.has(p.id)).map((p) => ({ ...p, robo: robos.has(p.id) })),
    acessos,
    acoes: [
      ...eventos.map((e) => ({ usuario_id: e.usuario_id, tipo: e.tipo, quando: e.criado_em, pontos: e.pontos })),
      ...movimentos.map((m) => ({ usuario_id: m.usuario_id, tipo: m.tipo, quando: m.criado_em, valor: m.valor })),
    ],
  });
  // desde quando o tempo é medido (antes da 1.8.0 não havia batida): a tela avisa
  const { data: primeiro } = await supabase.from("proof_acessos").select("inicio").order("inicio").limit(1).maybeSingle();
  return { periodo, periodos: PERIODOS_DO_USO, desde, medindoDesde: primeiro?.inicio || null, batidaSegundos: PRESENCA.batidaSegundos, ...resumo };
}
