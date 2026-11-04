// O limite diário do USUÁRIO (01/11/2026, o MVP — as chaves de IA são do admin). Cada pergunta,
// desenho, comentário de tela e fala conta em lisa_uso (db/mvp_usuarios.sql), numa operação só no
// banco (lisa_contar_uso). Admin não conta. Os limites: src/lib/modoUsuario.js (LISA_LIMITE_*).
//
// Se o banco falhar (a tabela ainda não existe, o banco caiu), o pedido passa: o limite protege a
// cota, não a porta — quem barra o acesso é o portão (src/middleware.js).

import { supabase } from "./supabase.js";
import { sessaoDe } from "./papelNaSessao.js";
import { limitesDoDia, mensagemDoLimite } from "./modoUsuario.js";

/**
 * Conta um uso do tipo ("pergunta" | "desenho" | "tela" | "voz") para o usuário do pedido.
 * Devolve null se pode seguir, ou { erro, status: 429 } se o limite do dia acabou.
 */
export async function usarDoDia(req, tipo) {
  const { dono, papel } = sessaoDe(req);
  if (papel !== "usuario" || !dono) return null;
  const limite = limitesDoDia(process.env)[tipo];
  try {
    const { data, error } = await supabase.rpc("lisa_contar_uso", { p_dono: dono, p_tipo: tipo });
    if (error) { console.warn(`[usoDoDia] não consegui contar (${tipo}): ${error.message}`); return null; }
    return Number(data) > limite ? { erro: mensagemDoLimite(tipo, limite), status: 429 } : null;
  } catch (err) {
    console.warn(`[usoDoDia] não consegui contar (${tipo}): ${err?.message || err}`);
    return null;
  }
}

/** A resposta JSON de limite estourado (rotas que respondem JSON). */
export const respostaDoLimite = (limite) => Response.json({ ok: false, error: limite.erro, limite: true }, { status: limite.status });
