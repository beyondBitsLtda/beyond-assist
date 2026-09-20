// Confere que a Lisa consegue mesmo ler o Abacato.
//
// A Lisa lê as tabelas `abacato_*` DIRETO do Postgres compartilhado, sem passar pela API do
// Abacato. É a escolha certa — ela já tem a chave-mestra deste banco, e uma rota HTTP só
// acrescentaria um segredo, um salto de rede e uma dependência de o Worker do Abacato estar no
// ar. Mas ela cria um contrato que nenhum compilador confere: o dia em que uma coluna mudar de
// nome no Abacato, a Lisa não quebra com erro — ela devolve uma lista vazia, e o painel de
// tarefas simplesmente diz que não há nada a fazer.
//
// Essa é a pior falha possível aqui. Este script existe para ela ser descoberta por um comando,
// e não por alguém perdendo um prazo.
//
// Uso:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/abacato-check.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const sb = createClient(url, chave, { auth: { persistSession: false } });

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok     ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA  ${t}${d ? `  — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t, typeof d === "string" ? d : "") : falha(t, d));

// Exatamente as colunas que src/lib/ingest/abacato.js pede. Manter esta lista igual à de lá é
// o trabalho que este script cobra — e é muito mais barato que descobrir pela tela.
const CONTRATO = {
  abacato_quadros: ["id", "nome", "arquivado", "criado_em"],
  abacato_colunas: ["id", "quadro_id", "nome", "posicao", "arquivada"],
  abacato_cards: ["id", "coluna_id", "titulo", "descricao", "posicao", "inicio_em", "fim_em", "concluido", "arquivado", "criado_em"],
  abacato_etiquetas: ["id", "quadro_id", "nome"],
  abacato_card_etiquetas: ["card_id", "etiqueta_id"],
  abacato_checklists: ["id", "card_id", "titulo"],
  abacato_checklist_itens: ["checklist_id", "texto", "feito"],
};

console.log(`\nA Lisa consegue ler o Abacato? — ${url}\n`);
console.log("1) as tabelas e colunas que a Lisa pede");

for (const [tabela, colunas] of Object.entries(CONTRATO)) {
  // Pedir as colunas de uma vez é o próprio teste: o PostgREST recusa a consulta inteira se
  // qualquer uma não existir, e diz o nome da que faltou.
  const { error } = await sb.from(tabela).select(colunas.join(", ")).limit(1);
  if (error) falha(`${tabela} (${colunas.length} colunas)`, error.message);
  else ok(`${tabela}`, `${colunas.length} colunas`);
}

console.log("\n2) o caminho completo, como a Lisa faz");
{
  // Reproduz a subida quadro > coluna > card. Se as chaves estrangeiras mudarem, isto para de
  // devolver linha mesmo com todas as colunas existindo.
  const { data: quadros, error: e1 } = await sb
    .from("abacato_quadros").select("id, nome").eq("arquivado", false);
  if (e1) {
    falha("listar quadros", e1.message);
  } else {
    ok("listar quadros", `${quadros.length} quadro(s) ativos`);

    if (quadros.length) {
      const ids = quadros.map((q) => q.id);
      const { data: colunas } = await sb
        .from("abacato_colunas").select("id, quadro_id, nome").in("quadro_id", ids).eq("arquivada", false);
      conferir("as colunas apontam para os quadros", (colunas || []).length > 0, `${(colunas || []).length} coluna(s)`);

      const idsCol = (colunas || []).map((c) => c.id);
      if (idsCol.length) {
        const { data: cards } = await sb
          .from("abacato_cards").select("id, coluna_id, titulo, fim_em, concluido")
          .in("coluna_id", idsCol).eq("arquivado", false);
        ok("os cards apontam para as colunas", `${(cards || []).length} card(s) à vista`);

        // O `concluido` é a coluna mais nova do contrato, e a que a Lisa usa para NÃO chamar de
        // atrasado o que já foi feito. Vale conferir que ela chegou mesmo ao banco.
        const temConcluido = (cards || []).every((c) => typeof c.concluido === "boolean");
        conferir("todo card responde se está concluído", temConcluido || !(cards || []).length);
      }
    }
  }
}

console.log("\n3) a tabela de configuração do interruptor");
{
  const { data, error } = await sb.from("lisa_config").select("chave, valor").eq("chave", "fonte_dos_quadros").maybeSingle();
  if (error) falha("ler lisa_config", `${error.message} — rode db/config.sql`);
  else if (!data) falha("a chave fonte_dos_quadros não existe", "rode db/config.sql");
  else conferir("a fonte está configurada", ["trello", "abacato"].includes(data.valor), `está em "${data.valor}"`);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU — a Lisa enxerga o Abacato.\n");
process.exit(falhas ? 1 : 0);
