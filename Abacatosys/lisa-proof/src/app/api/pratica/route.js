import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { resumoDaPratica } from "@/lib/pratica.js";
import { temModelo } from "@/lib/ia.js";
import { diaDe } from "@/dominio/datas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pratica — por trilha ativa: o assunto da vez, quiz e exercício de hoje e o projeto da semana do plano (ou o final). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const { data: trilhas, error } = await supabase
      .from("proof_trilhas").select("id, tema, inicio_em, dias_de_estudo").eq("usuario_id", usuario.id).eq("status", "ativa").order("tema");
    if (error) throw new ErroDeAcesso(500, error.message);
    const hoje = diaDe();
    return json({ ok: true, hoje, iaDisponivel: temModelo(), trilhas: await resumoDaPratica(usuario.id, trilhas || [], hoje) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
