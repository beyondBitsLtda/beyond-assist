import { supabase } from "./supabase.js";
import { exigir, ErroDeAcesso } from "./acesso.js";
import { papelValido } from "@/dominio/papeis.js";
import { exigirPodeCompartilhar } from "./limites.js";
import { anotar, anotarLimite, TIPOS_DE_EVENTO } from "./eventos.js";

/**
 * Quem participa de um quadro ou de um projeto, e com qual papel.
 *
 * Uma peça só para os dois, porque a regra é a mesma: quem pode `convidar` mexe na lista, o
 * dono nunca é removido, e um papel inventado não entra. Duas cópias disto divergiriam na
 * primeira vez que alguém corrigisse um caso numa delas — e a cópia esquecida seria justamente
 * a que decide quem lê os documentos.
 */
const TIPOS = {
  quadro: {
    tabela: "abacato_membros",
    coluna: "quadro_id",
    dono: { tabela: "abacato_quadros", campo: "dono_id" },
  },
  projeto: {
    tabela: "abacato_projeto_membros",
    coluna: "projeto_id",
    dono: { tabela: "abacato_projetos", campo: "dono_id" },
  },
};

/** A lista de quem participa, com o dono sempre em primeiro. */
export async function listarMembros(tipo, id) {
  const t = TIPOS[tipo];
  const { data: raiz } = await supabase
    .from(t.dono.tabela).select(`${t.dono.campo}`).eq("id", id).maybeSingle();

  const [{ data: membros }, { data: dono }] = await Promise.all([
    supabase.from(t.tabela)
      .select(`usuario_id, papel, criado_em, abacato_usuarios ( id, nome, email, ativo )`)
      .eq(t.coluna, id),
    supabase.from("abacato_usuarios")
      .select("id, nome, email, ativo").eq("id", raiz?.[t.dono.campo]).maybeSingle(),
  ]);

  const lista = [];
  // O dono aparece na lista mesmo sem linha na tabela de membros. Ele é dono pelo `dono_id`, e
  // uma lista de participantes sem quem criou a coisa confunde mais do que informa.
  if (dono) lista.push({ ...dono, papel: "dono", ehDono: true });
  for (const m of membros || []) {
    const u = m.abacato_usuarios;
    if (!u || u.id === dono?.id) continue;
    lista.push({ ...u, papel: m.papel, ehDono: false, desde: m.criado_em });
  }
  return lista;
}

/** Põe alguém, ou muda o papel de quem já está. */
export async function porMembro(req, tipo, id, usuarioId, papel) {
  const t = TIPOS[tipo];
  const { usuario } = await exigir(req, tipo, id, "convidar");

  if (!usuarioId) throw new ErroDeAcesso(400, "faltou a pessoa");
  if (!papelValido(papel)) throw new ErroDeAcesso(400, "papel inválido");

  const { data: alvo } = await supabase
    .from("abacato_usuarios").select("id, nome, email, ativo, aprovado").eq("id", usuarioId).maybeSingle();
  if (!alvo) throw new ErroDeAcesso(404, "pessoa não encontrada");
  // Convidar uma conta desligada cria um acesso que não funciona e parece que funciona — a
  // pessoa aparece na lista e nunca consegue entrar.
  if (!alvo.ativo) throw new ErroDeAcesso(400, "essa conta está desativada");
  // Nem uma conta que ainda espera aprovação. Ela existe no banco e ainda não é ninguém aqui
  // dentro; pôr essa pessoa num quadro seria aprová-la por um caminho lateral.
  if (alvo.aprovado === false) throw new ErroDeAcesso(400, "essa conta ainda aguarda aprovação");

  const { data: raiz } = await supabase
    .from(t.dono.tabela).select(`${t.dono.campo}`).eq("id", id).maybeSingle();
  if (raiz?.[t.dono.campo] === usuarioId) {
    throw new ErroDeAcesso(400, "essa pessoa é a dona — o papel dela não se muda por aqui");
  }

  // Quantas pessoas cabem aqui e quantas coisas esta conta pode ter compartilhadas. Quem manda
  // é o plano do DONO — e não o de quem está convidando, que pode ser um convidado com poder de
  // convidar. É aqui, e não nas duas rotas, porque as duas passam por esta função: uma trava na
  // rota se esquece na próxima rota que aparecer.
  try {
    await exigirPodeCompartilhar(tipo, id, usuarioId);
  } catch (e) {
    anotarLimite({ usuarioId: usuario.id, limite: tipo === "projeto" ? "projetosCompartilhados" : "quadrosCompartilhados" });
    throw e;
  }

  const { error } = await supabase.from(t.tabela)
    .upsert({ [t.coluna]: id, usuario_id: usuarioId, papel }, { onConflict: `${t.coluna},usuario_id` });
  if (error) throw new ErroDeAcesso(500, error.message);

  anotar({
    usuarioId: usuario.id, tipo: TIPOS_DE_EVENTO.compartilhou, alvo: alvo.email, alvoId: id,
    detalhe: { tipo, papel },
  });
  return { usuario, alvo, papel };
}

/** Tira alguém. O dono não sai. */
export async function tirarMembro(req, tipo, id, usuarioId) {
  const t = TIPOS[tipo];
  await exigir(req, tipo, id, "convidar");

  const { data: raiz } = await supabase
    .from(t.dono.tabela).select(`${t.dono.campo}`).eq("id", id).maybeSingle();
  if (raiz?.[t.dono.campo] === usuarioId) {
    // Sem esta trava, o dono sairia da própria coisa e ela ficaria sem ninguém que pudesse
    // arquivá-la ou convidar alguém de volta.
    throw new ErroDeAcesso(400, "o dono não pode ser removido");
  }

  const { error } = await supabase.from(t.tabela)
    .delete().eq(t.coluna, id).eq("usuario_id", usuarioId);
  if (error) throw new ErroDeAcesso(500, error.message);
}
