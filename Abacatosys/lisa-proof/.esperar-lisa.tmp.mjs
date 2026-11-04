// Só leitura: espera aparecer no diário da Lisa uma jogada feita depois do deploy (o relógio da nuvem, a cada
// 20 minutos) e mostra as últimas. Roda na pasta do lisa-proof com --env-file=.env.local.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const desde = new Date(process.argv[2]);
const LISA = "lisa.jogadora@proof.beyond.dev.br";
const { data: conta } = await sb.from("abacato_usuarios").select("id").ilike("email", LISA).maybeSingle();
if (!conta) { console.log("conta da Lisa não encontrada"); process.exit(1); }
const fim = Date.now() + 28 * 60_000;
while (Date.now() < fim) {
  const { data, error } = await sb.from("proof_lisa_diario").select("acao, resumo, criado_em").eq("usuario_id", conta.id).gt("criado_em", desde.toISOString()).order("criado_em", { ascending: false }).limit(10);
  if (error) { console.log("erro:", error.message); process.exit(1); }
  if (data.length) {
    console.log(`jogadas desde ${desde.toISOString()}:`);
    for (const d of data) console.log(`  ${d.criado_em}  ${d.acao}: ${d.resumo.slice(0, 160)}`);
    process.exit(0);
  }
  await new Promise((ok) => setTimeout(ok, 60_000));
}
console.log("nenhuma jogada nova em 28 minutos");
process.exit(2);
