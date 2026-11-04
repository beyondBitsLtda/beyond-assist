import { json } from "@/lib/http.js";
import { supabase, temBanco } from "@/lib/supabase.js";
import { temModelo } from "@/lib/gemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saude — o que está configurado, sem revelar valor nenhum.
 *
 * `?banco=1` também confere se as tabelas `proof_` existem: é o sintoma de "esqueci de rodar a
 * migração", que de outro jeito aparece como erro 500 na primeira tela.
 */
export async function GET(req) {
  const estado = {
    ok: true,
    banco: temBanco(),
    sessao: Boolean(process.env.PROOF_SESSAO_SECRET),
    ia: temModelo(),
  };

  if (new URL(req.url).searchParams.get("banco") === "1" && estado.banco) {
    const { error } = await supabase.from("proof_trilhas").select("id").limit(1);
    estado.tabelas = error ? `falhou: ${error.message}` : "ok";
  }

  // A IA fica fora da conta: sem ela o app funciona, só sem trilha montada pela Lisa.
  estado.ok = estado.banco && estado.sessao && (estado.tabelas === undefined || estado.tabelas === "ok");
  return json(estado, estado.ok ? 200 : 503);
}
