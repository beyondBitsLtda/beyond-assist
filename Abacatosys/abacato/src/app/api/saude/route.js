import { json } from "@/lib/http.js";
import { supabase, temBanco } from "@/lib/supabase.js";
import { testarCripto, testarCriptoDoServidor } from "@/lib/abacatoAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saude — quatro booleanos, sem login.
 *
 * Distingue "configuração faltando" de "banco fora do ar", que pedem consertos em lugares
 * diferentes: um é variável de ambiente, o outro é o iMac.
 */
export async function GET(req) {
  // `?cripto=1` usa o número padrão; `?cripto=50000` testa um número específico, que é como se
  // descobre quanto de PBKDF2 cabe neste servidor sem estourar a CPU.
  const pedido = new URL(req.url).searchParams.get("cripto");
  const cripto = pedido ? await testarCripto(pedido === "1" ? undefined : Number(pedido)) : null;

  let banco = false;
  if (temBanco()) {
    const { error } = await supabase.from("abacato_usuarios").select("id", { count: "exact", head: true });
    banco = !error;
  }
  return json({
    configurado: temBanco(),
    banco,
    sessao: Boolean(process.env.ABACATO_SESSAO_SECRET),
    // O selo é o que o SERVIDOR faz por login, e hoje custa microssegundos — por isso ele pode
    // ser testado sempre. Era o oposto até pouco tempo: o servidor esticava a senha, gastava
    // ~150ms de CPU e o Worker respondia 1102 depois de três logins. Se este número voltar a
    // subir, alguém devolveu trabalho pesado para cá sem perceber.
    selo: await testarCriptoDoServidor(),
    // A esticada da senha (que hoje acontece no NAVEGADOR) só é testada quando pedida:
    // `/api/saude?cripto=1`. Ela custa CPU de verdade, e uma rota de saúde que derruba o
    // servidor que deveria vigiar não serve para nada.
    //
    ...(cripto === null ? {} : { cripto }),
  });
}
