import { COOKIE_SESSAO, conferirToken, papelDe, adminsDe } from "@/lib/authSession.js";
import { supabase } from "@/lib/supabase.js";
import { limitesDoDia } from "@/lib/modoUsuario.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// o dia de hoje no fuso de Brasília, como o banco conta (lisa_contar_uso)
const hojeEmBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** O uso de hoje do usuário: { pergunta: { usados, limite }, … } (null se não deu para ler). */
async function usoDeHoje(dono) {
  try {
    const { data, error } = await supabase.from("lisa_uso").select("tipo, quantos").eq("dono_id", dono).eq("dia", hojeEmBrasilia());
    if (error) return null;
    const limites = limitesDoDia(process.env);
    const usados = Object.fromEntries((data || []).map((l) => [l.tipo, l.quantos]));
    return Object.fromEntries(Object.entries(limites).map(([tipo, limite]) => [tipo, { usados: usados[tipo] || 0, limite }]));
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/eu → { logado, papel: "admin" | "usuario" | null, modoMvp, email, expiraEm, uso }
 * (01/11/2026, o MVP; e depois: "faltou um botão de poder sair da Lisa e ver as informações da
 * conta"). A tela usa o papel para esconder o que o usuário não usa (quem barra é o portão) e o
 * resto para o menu da conta. `uso`: só para o usuário — o quanto ele já usou hoje do limite.
 * Mora em /api/auth/, que não pede login — por isso confere o token aqui mesmo.
 */
export async function GET(req) {
  const r = await conferirToken(req.cookies.get(COOKIE_SESSAO)?.value, process.env.SUPABASE_JWT_SECRET);
  const modoMvp = adminsDe(process.env.LISA_ADMINS).length > 0;
  if (!r.ok) return Response.json({ ok: true, logado: false, papel: null, modoMvp }, { headers: { "cache-control": "no-store" } });
  const papel = papelDe(r.payload, process.env.LISA_ADMINS);
  return Response.json({
    ok: true, logado: true, papel, modoMvp,
    email: String(r.payload.email || ""),
    expiraEm: typeof r.payload.exp === "number" ? new Date(r.payload.exp * 1000).toISOString() : null,
    uso: papel === "usuario" && r.payload.sub ? await usoDeHoje(r.payload.sub) : null,
  }, { headers: { "cache-control": "no-store" } });
}
