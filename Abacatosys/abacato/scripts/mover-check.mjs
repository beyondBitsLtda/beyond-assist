// Mover e copiar entre quadros — e o que isso faz com etiqueta, responsável e permissão.
//
// É a operação mais perigosa do sistema depois do login: um card que atravessa a fronteira
// leva consigo quem pode lê-lo. Uma trava frouxa aqui não vaza para um colega, vaza para
// qualquer pessoa que descubra um id.
//
// Cria dois quadros e uma conta descartável, atravessa cards nos dois sentidos, e confere no
// BANCO o que sobrou de cada travessia. No fim apaga tudo.
//
// Uso:  ABACATO_URL=http://localhost:3210 node --env-file=.env.local scripts/mover-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveDeLogin, guardarSenha } from "../src/lib/abacatoAuth.js";
import { sortearSenha } from "../src/dominio/papeis.js";

const base = (process.argv[2] || process.env.ABACATO_URL || "http://localhost:3000").replace(/\/$/, "");
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });

const txt = fs.readFileSync(path.join(os.homedir(), "senha-abacato.txt"), "utf8");
const emailAdmin = txt.match(/e-mail:\s*(\S+)/)[1].trim();
const senhaAdmin = txt.match(/senha:\s*(\S+)/)[1].trim();

let falhas = 0, passaram = 0;
const conferir = (t, ok, d = "") => {
  ok ? passaram++ : falhas++;
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${t}${d ? `  — ${d}` : ""}`);
};
const secao = (t) => console.log(`\n${t}`);

async function chamar(s, metodo, caminho, corpo) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { "content-type": "application/json", ...(s?.cookie ? { cookie: s.cookie } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    redirect: "manual",
  });
  const bruto = await r.text();
  let dados = null;
  try { dados = JSON.parse(bruto); } catch {}
  const set = r.headers.get("set-cookie");
  if (s && set) { const p = set.split(";")[0]; if (p.startsWith("abacato_sessao=")) s.cookie = p; }
  return { status: r.status, dados };
}
async function entrar(email, senha) {
  const s = { cookie: "" };
  const r = await chamar(s, "POST", "/api/auth/entrar", { email, chave: await chaveDeLogin(email, senha) });
  return { s, status: r.status, dados: r.dados };
}

const lixo = { usuarios: [], quadros: [] };
async function limpar() {
  if (lixo.quadros.length) await sb.from("abacato_quadros").delete().in("id", lixo.quadros);
  if (lixo.usuarios.length) await sb.from("abacato_usuarios").delete().in("id", lixo.usuarios);
}

console.log(`\nMover e copiar entre quadros — ${base}\n`);

try {
  const admin = await entrar(emailAdmin, senhaAdmin);
  if (admin.status !== 200) throw new Error("não entrei como administrador");
  const marca = Date.now().toString(36);

  // Uma pessoa que participa do quadro A e NÃO do quadro B. É ela que prova a regra.
  const emailOutra = `mover-${marca}@abacato.teste`;
  const senhaOutra = sortearSenha();
  const g = await guardarSenha(emailOutra, senhaOutra);
  const nova = await chamar(admin.s, "POST", "/api/usuarios", {
    email: emailOutra, nome: "Moveu Teste", hash: g.hash, sal: g.sal, iteracoes: g.iteracoes,
  });
  const idOutra = nova.dados.usuario.id;
  lixo.usuarios.push(idOutra);
  const outra = await entrar(emailOutra, senhaOutra);

  // Dois quadros.
  const a = await chamar(admin.s, "POST", "/api/quadros", { nome: `Origem ${marca}` });
  const b = await chamar(admin.s, "POST", "/api/quadros", { nome: `Destino ${marca}` });
  const quadroA = a.dados.quadro.id, quadroB = b.dados.quadro.id;
  lixo.quadros.push(quadroA, quadroB);

  const dentroA = await chamar(admin.s, "GET", `/api/quadros/${quadroA}`);
  const dentroB = await chamar(admin.s, "GET", `/api/quadros/${quadroB}`);
  const colA = dentroA.dados.quadro.colunas[0].id;
  const colA2 = dentroA.dados.quadro.colunas[1].id;
  const colB = dentroB.dados.quadro.colunas[0].id;

  // Só no quadro A: uma etiqueta e a pessoa como membro.
  await chamar(admin.s, "POST", `/api/quadros/${quadroA}/etiquetas`, { nome: "Urgente", cor: "#EF4444" });
  await chamar(admin.s, "POST", `/api/quadros/${quadroA}/membros`, { usuarioId: idOutra, papel: "editor" });

  const { data: etiqueta } = await sb.from("abacato_etiquetas")
    .select("id, nome, cor").eq("quadro_id", quadroA).ilike("nome", "Urgente").maybeSingle();

  // Um card no A, com a etiqueta e a pessoa como responsável.
  const card = await chamar(admin.s, "POST", `/api/colunas/${colA}/cards`, { titulo: `Viajante ${marca}` });
  const cardId = card.dados.card.id;
  await chamar(admin.s, "PUT", `/api/cards/${cardId}/etiquetas`, { etiquetas: [etiqueta.id] });
  await chamar(admin.s, "PUT", `/api/cards/${cardId}/responsaveis`, { responsaveis: [idOutra] });

  // ------------------------------------------------------------ destinos
  secao("Para onde dá para mandar");
  {
    const d = await chamar(admin.s, "GET", "/api/destinos");
    const nomes = (d.dados?.quadros || []).map((q) => q.nome);
    conferir("lista os quadros em que dá para criar",
      nomes.includes(`Origem ${marca}`) && nomes.includes(`Destino ${marca}`));
    const doDestino = d.dados.quadros.find((q) => q.id === quadroB);
    conferir("com as colunas de cada um", doDestino?.colunas?.length === 3, `${doDestino?.colunas?.length}`);

    const dela = await chamar(outra.s, "GET", "/api/destinos");
    const delaNomes = (dela.dados?.quadros || []).map((q) => q.nome);
    conferir("e quem só participa de um vê só aquele",
      delaNomes.includes(`Origem ${marca}`) && !delaNomes.includes(`Destino ${marca}`),
      delaNomes.join(", "));
  }

  // ------------------------------------------------------------ dentro do mesmo quadro
  secao("Mover dentro do mesmo quadro não mexe em nada");
  {
    const r = await chamar(admin.s, "POST", `/api/cards/${cardId}/mover`, { colunaId: colA2 });
    conferir("o card muda de coluna", r.status === 200 && r.dados.mudouDeQuadro === false);

    const { count: comEtiqueta } = await sb.from("abacato_card_etiquetas")
      .select("card_id", { count: "exact", head: true }).eq("card_id", cardId);
    conferir("a etiqueta continua", comEtiqueta === 1, `${comEtiqueta}`);
    const { count: comDono } = await sb.from("abacato_card_responsaveis")
      .select("card_id", { count: "exact", head: true }).eq("card_id", cardId);
    conferir("o responsável continua", comDono === 1, `${comDono}`);
  }

  // ------------------------------------------------------------ a fronteira
  secao("A fronteira: as duas permissões");
  {
    // Ela edita no A, mas não cria no B. Mover exige as duas.
    const tentou = await chamar(outra.s, "POST", `/api/cards/${cardId}/mover`, { colunaId: colB });
    conferir("quem não alcança o destino não move para lá",
      tentou.status === 404 || tentou.status === 403, `status ${tentou.status}`);

    const { data: onde } = await sb.from("abacato_cards").select("coluna_id").eq("id", cardId).maybeSingle();
    conferir("e o card NÃO saiu do lugar", onde.coluna_id === colA2);
  }

  // ------------------------------------------------------------ a travessia
  secao("Atravessando de verdade");
  {
    const r = await chamar(admin.s, "POST", `/api/cards/${cardId}/mover`, { colunaId: colB });
    conferir("o card atravessa", r.status === 200 && r.dados.mudouDeQuadro === true);
    conferir("e a resposta diz que criou a etiqueta lá",
      r.dados.etiquetasCriadas?.includes("Urgente"), JSON.stringify(r.dados.etiquetasCriadas));
    // A pessoa não participa do quadro B: ficaria com uma tarefa que não consegue abrir.
    conferir("e que tirou quem não alcança o quadro novo",
      r.dados.responsaveisRemovidos?.includes("Moveu Teste"), JSON.stringify(r.dados.responsaveisRemovidos));

    const { data: etiquetasLa } = await sb.from("abacato_etiquetas")
      .select("id, nome, cor").eq("quadro_id", quadroB);
    const recriada = (etiquetasLa || []).find((e) => e.nome === "Urgente");
    conferir("a etiqueta existe no quadro de destino", Boolean(recriada), recriada?.cor);
    conferir("com a mesma cor", recriada?.cor === "#EF4444", recriada?.cor);

    const { data: ligacoes } = await sb.from("abacato_card_etiquetas")
      .select("etiqueta_id").eq("card_id", cardId);
    conferir("o card aponta para a etiqueta DE LÁ, não para a de origem",
      ligacoes?.length === 1 && ligacoes[0].etiqueta_id === recriada.id,
      JSON.stringify(ligacoes));
    // Esta é a que mais importa: um etiqueta_id de outro quadro grudado no card seria uma
    // etiqueta que ninguém do quadro B consegue ver nem tirar.
    conferir("e a etiqueta do quadro de origem NÃO ficou grudada",
      ligacoes?.[0]?.etiqueta_id !== etiqueta.id);

    const { count: donos } = await sb.from("abacato_card_responsaveis")
      .select("card_id", { count: "exact", head: true }).eq("card_id", cardId);
    conferir("e ninguém sobrou como responsável", donos === 0, `${donos}`);

    const viu = await chamar(outra.s, "GET", `/api/quadros/${quadroA}`);
    const aindaLa = (viu.dados?.quadro?.colunas || []).some((c) => c.cards.some((x) => x.id === cardId));
    conferir("o card sumiu do quadro de origem", !aindaLa);
  }

  // ------------------------------------------------------------ copiar
  secao("Copiar escolhendo o destino");
  {
    const c2 = await chamar(admin.s, "POST", `/api/colunas/${colA}/cards`, { titulo: `Copiável ${marca}` });
    const copiavel = c2.dados.card.id;
    await chamar(admin.s, "PUT", `/api/cards/${copiavel}/etiquetas`, { etiquetas: [etiqueta.id] });

    const r = await chamar(admin.s, "POST", `/api/cards/${copiavel}/copiar`, { colunaId: colB });
    conferir("a cópia vai para o quadro escolhido", r.status === 201 && r.dados.mudouDeQuadro === true);

    const { data: original } = await sb.from("abacato_cards").select("id, coluna_id").eq("id", copiavel).maybeSingle();
    conferir("o ORIGINAL continua onde estava", original?.coluna_id === colA);

    const { data: copia } = await sb.from("abacato_cards")
      .select("id, coluna_id, titulo").eq("id", r.dados.cardId).maybeSingle();
    conferir("e a cópia nasceu na coluna de destino", copia?.coluna_id === colB, copia?.titulo);

    const { data: ligacoes } = await sb.from("abacato_card_etiquetas")
      .select("etiqueta_id").eq("card_id", copia.id);
    conferir("com a etiqueta traduzida, não a de origem",
      ligacoes?.length === 1 && ligacoes[0].etiqueta_id !== etiqueta.id, JSON.stringify(ligacoes));

    // Copiar também exige poder criar no destino.
    const proibida = await chamar(outra.s, "POST", `/api/cards/${copiavel}/copiar`, { colunaId: colB });
    conferir("quem não alcança o destino não copia para lá",
      proibida.status === 404 || proibida.status === 403, `status ${proibida.status}`);
  }

  // ------------------------------------------------------------ coluna inteira
  secao("Mover uma coluna inteira");
  {
    const cards = await Promise.all([1, 2, 3].map((n) =>
      chamar(admin.s, "POST", `/api/colunas/${colA}/cards`, { titulo: `Na coluna ${n} ${marca}` })));
    const ids = cards.map((c) => c.dados.card.id);
    await chamar(admin.s, "PUT", `/api/cards/${ids[0]}/etiquetas`, { etiquetas: [etiqueta.id] });

    const antes = await sb.from("abacato_cards").select("id", { count: "exact", head: true }).eq("coluna_id", colA);

    const naoPode = await chamar(outra.s, "POST", `/api/colunas/${colA}/mover`, { quadroId: quadroB });
    conferir("quem não alcança o destino não move a coluna para lá",
      naoPode.status === 404 || naoPode.status === 403, `status ${naoPode.status}`);

    const r = await chamar(admin.s, "POST", `/api/colunas/${colA}/mover`, { quadroId: quadroB });
    conferir("a coluna atravessa", r.status === 200, JSON.stringify(r.dados).slice(0, 80));
    conferir("levando os cards junto", r.dados.cards === antes.count, `${r.dados.cards} de ${antes.count}`);

    const { data: coluna } = await sb.from("abacato_colunas")
      .select("quadro_id").eq("id", colA).maybeSingle();
    conferir("e agora ela é do quadro de destino", coluna?.quadro_id === quadroB);

    const { data: lig } = await sb.from("abacato_card_etiquetas")
      .select("etiqueta_id").eq("card_id", ids[0]);
    conferir("o card da coluna teve a etiqueta traduzida",
      lig?.length === 1 && lig[0].etiqueta_id !== etiqueta.id, JSON.stringify(lig));

    // Nenhuma etiqueta duplicada: três cards com a mesma etiqueta não podem criar três.
    const { data: todas } = await sb.from("abacato_etiquetas")
      .select("id, nome").eq("quadro_id", quadroB).ilike("nome", "Urgente");
    conferir("e a etiqueta não foi criada várias vezes no destino", todas?.length === 1, `${todas?.length}`);
  }
} catch (e) {
  conferir(`o teste parou no meio: ${e.message}`, false);
} finally {
  await limpar();
  console.log(`\n(limpeza: ${lixo.quadros.length} quadro(s), ${lixo.usuarios.length} conta(s))`);
}

console.log(falhas === 0
  ? `\nTUDO PASSOU — ${passaram} verificações.\n`
  : `\n${falhas} FALHA(S) em ${passaram + falhas} verificações.\n`);
process.exit(falhas === 0 ? 0 : 1);
