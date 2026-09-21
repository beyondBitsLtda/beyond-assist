// O Quadro Gen: conversar para montar um quadro.
//
// A parte que vale testar não é a conversa — é a PROMESSA da tela: nada existe no banco até
// alguém clicar em criar. Uma assistente que cria enquanto conversa é uma assistente que
// enche o sistema de quadros que ninguém pediu, e o teste é o que impede isso de voltar.
//
// A validação da proposta roda sem rede: ela é domínio puro, e é onde as cores inventadas e
// as colunas que não existem são barradas.
//
// Uso:  ABACATO_URL=http://localhost:3210 node --env-file=.env.local scripts/quadro-gen-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";
import { validarProposta, resumirProposta, LIMITES } from "../src/dominio/quadroGen.js";

const base = (process.argv[2] || process.env.ABACATO_URL || "http://localhost:3000").replace(/\/$/, "");
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });

const txt = fs.readFileSync(path.join(os.homedir(), "senha-abacato.txt"), "utf8");
const email = txt.match(/e-mail:\s*(\S+)/)[1].trim();
const senha = txt.match(/senha:\s*(\S+)/)[1].trim();

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

const lixo = [];
async function limpar() {
  if (lixo.length) await sb.from("abacato_quadros").delete().in("id", lixo);
}

console.log(`\nQuadro Gen — ${base}\n`);

try {
  // ------------------------------------------------------- a validação, sem rede
  secao("A proposta é conferida antes de virar qualquer coisa");
  {
    const vazia = validarProposta(null);
    conferir("proposta vazia é recusada", !vazia.ok, vazia.erros.join("; "));

    const semColuna = validarProposta({ nome: "X", colunas: [] });
    conferir("quadro sem coluna é recusado", !semColuna.ok, semColuna.erros.join("; "));

    const semNome = validarProposta({ colunas: [{ nome: "A" }] });
    conferir("quadro sem nome é recusado", !semNome.ok);

    // Cor inventada NÃO derruba a proposta: gira na paleta e avisa. O modelo acerta o
    // conceito da etiqueta e erra o tom o tempo todo, e o tom é o que menos importa.
    const corTorta = validarProposta({
      nome: "X", colunas: [{ nome: "A" }],
      etiquetas: [{ nome: "Urgente", cor: "#123456" }],
    });
    conferir("cor fora da paleta é corrigida, não recusada", corTorta.ok);
    conferir("e a correção é dita", corTorta.avisos.some((a) => a.includes("#123456")), corTorta.avisos.join(" · "));
    conferir("a cor final é da paleta", /^#[0-9A-F]{6}$/i.test(corTorta.proposta.etiquetas[0].cor),
      corTorta.proposta.etiquetas[0].cor);

    // Card apontando para coluna que não existe cai na primeira — a fila.
    const colunaTorta = validarProposta({
      nome: "X", colunas: [{ nome: "A fazer" }, { nome: "Feito" }],
      cards: [{ titulo: "Solto", coluna: "Inventada" }],
    });
    conferir("card em coluna inexistente vai para a primeira",
      colunaTorta.proposta.cards[0].coluna === "A fazer", colunaTorta.proposta.cards[0].coluna);
    conferir("e isso também é dito", colunaTorta.avisos.some((a) => a.includes("Inventada")));

    const duplicada = validarProposta({
      nome: "X", colunas: [{ nome: "A fazer" }, { nome: "a fazer" }],
    });
    conferir("coluna repetida vira uma só", duplicada.proposta.colunas.length === 1);

    const gigante = validarProposta({
      nome: "X", colunas: [{ nome: "A" }],
      cards: Array.from({ length: LIMITES.cards + 5 }, (_, i) => ({ titulo: `t${i}`, coluna: "A" })),
    });
    conferir("um quadro grande demais é recusado", !gigante.ok, gigante.erros.join("; "));

    const boa = validarProposta({
      nome: "Obras", colunas: [{ nome: "A fazer" }, { nome: "Executando" }],
      etiquetas: [{ nome: "Urgente", cor: "#EF4444" }],
      cards: [{ titulo: "Medir o terreno", coluna: "A fazer", etiqueta: "Urgente", prazoEmDias: 3 }],
    });
    conferir("uma proposta boa passa", boa.ok, resumirProposta(boa.proposta));
    conferir("e o prazo em dias sobrevive", boa.proposta.cards[0].prazoEmDias === 3);
  }

  // ------------------------------------------------------- a porta
  secao("A porta");
  {
    const sem = await chamar(null, "POST", "/api/quadro-gen", { mensagens: [{ quem: "pessoa", texto: "oi" }] });
    conferir("sem sessão, não conversa (401)", sem.status === 401, `status ${sem.status}`);
    const semCriar = await chamar(null, "POST", "/api/quadro-gen/criar", { proposta: { nome: "X" } });
    conferir("sem sessão, não cria (401)", semCriar.status === 401, `status ${semCriar.status}`);
  }

  const s = { cookie: "" };
  const entrou = await chamar(s, "POST", "/api/auth/entrar", { email, chave: await chaveDeLogin(email, senha) });
  if (entrou.status !== 200) throw new Error("não consegui entrar");

  // ------------------------------------------------------- conversar
  secao("A conversa monta uma proposta");
  const marca = Date.now().toString(36);
  let proposta = null;
  {
    const antes = await sb.from("abacato_quadros").select("id", { count: "exact", head: true });

    // Uma mensagem que já traz tudo, para não depender de quantas perguntas o modelo faz.
    const r = await chamar(s, "POST", "/api/quadro-gen", {
      mensagens: [{
        quem: "pessoa",
        texto: `Monte agora um quadro chamado "Obras ${marca}" para acompanhar obras de clientes. ` +
          `As etapas são: A fazer, Em execução, Vistoria e Entregue. ` +
          `Ponha três tarefas iniciais e uma etiqueta de prioridade. Não me pergunte mais nada, proponha.`,
      }],
      fusoMinutos: 180,
    });
    conferir("a conversa responde", r.status === 200 && Boolean(r.dados?.texto),
      (r.dados?.texto || r.dados?.error || "").slice(0, 80));
    proposta = r.dados?.proposta;
    conferir("e veio uma proposta", Boolean(proposta), proposta ? resumirProposta(proposta) : "nenhuma");

    // ESTA É A VERIFICAÇÃO QUE MAIS IMPORTA DESTA TELA.
    const depois = await sb.from("abacato_quadros").select("id", { count: "exact", head: true });
    conferir("e NADA foi criado no banco ainda", depois.count === antes.count,
      `${antes.count} antes, ${depois.count} depois`);
  }

  // ------------------------------------------------------- criar
  secao("Criar, depois de aprovar");
  if (proposta) {
    const r = await chamar(s, "POST", "/api/quadro-gen/criar", { proposta, fusoMinutos: 180 });
    conferir("o quadro é criado", r.status === 201 && Boolean(r.dados?.quadroId),
      JSON.stringify(r.dados).slice(0, 90));
    if (r.dados?.quadroId) lixo.push(r.dados.quadroId);

    const { data: quadro } = await sb.from("abacato_quadros")
      .select("id, nome, dono_id").eq("id", r.dados.quadroId).maybeSingle();
    conferir("ele existe no banco", Boolean(quadro), quadro?.nome);

    const { data: colunas } = await sb.from("abacato_colunas")
      .select("id, nome, posicao").eq("quadro_id", r.dados.quadroId).order("posicao");
    conferir("com as colunas propostas", colunas?.length === proposta.colunas.length,
      `${colunas?.length} de ${proposta.colunas.length}`);
    conferir("na ordem em que foram propostas",
      colunas?.[0]?.nome === proposta.colunas[0].nome, colunas?.[0]?.nome);

    const ids = (colunas || []).map((c) => c.id);
    const { data: cards } = await sb.from("abacato_cards")
      .select("id, titulo, coluna_id, posicao").in("coluna_id", ids);
    conferir("e com os cards", cards?.length === proposta.cards.length,
      `${cards?.length} de ${proposta.cards.length}`);

    // A posição é contada POR COLUNA: um contador único faria os cards da segunda coluna
    // nascerem com posições altas e saltarem de lugar na primeira reordenação.
    const porColuna = new Map();
    for (const c of cards || []) {
      if (!porColuna.has(c.coluna_id)) porColuna.set(c.coluna_id, []);
      porColuna.get(c.coluna_id).push(c.posicao);
    }
    const posicoesOk = [...porColuna.values()].every((ps) => Math.min(...ps) === 1024);
    conferir("cada coluna começa a contar posição do zero", posicoesOk,
      JSON.stringify([...porColuna.values()]));

    if (proposta.etiquetas.length) {
      const { data: etiquetas } = await sb.from("abacato_etiquetas")
        .select("id, nome, cor").eq("quadro_id", r.dados.quadroId);
      conferir("as etiquetas existem", etiquetas?.length === proposta.etiquetas.length,
        `${etiquetas?.length}`);
    }
  }

  // ------------------------------------------------------- a segunda conferência
  secao("O que chega do navegador é conferido de novo");
  {
    // A proposta já foi validada quando nasceu — mas o que chega nesta rota vem do navegador,
    // e o navegador é de quem está do outro lado.
    const forjada = await chamar(s, "POST", "/api/quadro-gen/criar", {
      proposta: { nome: "Forjado", colunas: [] },
    });
    conferir("uma proposta sem coluna é recusada aqui também (400)", forjada.status === 400,
      `status ${forjada.status}`);

    const corInventada = await chamar(s, "POST", "/api/quadro-gen/criar", {
      proposta: {
        nome: `Cor forjada ${marca}`,
        colunas: [{ nome: "A" }],
        etiquetas: [{ nome: "X", cor: "javascript:alert(1)" }],
      },
    });
    conferir("uma cor forjada não entra como veio", corInventada.status === 201);
    if (corInventada.dados?.quadroId) {
      lixo.push(corInventada.dados.quadroId);
      const { data: e } = await sb.from("abacato_etiquetas")
        .select("cor").eq("quadro_id", corInventada.dados.quadroId).maybeSingle();
      conferir("a cor gravada é da paleta", /^#[0-9A-F]{6}$/i.test(e?.cor || ""), e?.cor);
    }

    const enorme = await chamar(s, "POST", "/api/quadro-gen/criar", {
      proposta: {
        nome: "Enorme", colunas: [{ nome: "A" }],
        cards: Array.from({ length: 200 }, (_, i) => ({ titulo: `t${i}`, coluna: "A" })),
      },
    });
    conferir("duzentos cards são recusados (400)", enorme.status === 400, `status ${enorme.status}`);
  }
} catch (e) {
  conferir(`o teste parou no meio: ${e.message}`, false);
} finally {
  await limpar();
  console.log(`\n(limpeza: ${lixo.length} quadro(s) de teste)`);
}

console.log(falhas === 0
  ? `\nTUDO PASSOU — ${passaram} verificações.\n`
  : `\n${falhas} FALHA(S) em ${passaram + falhas} verificações.\n`);
process.exit(falhas === 0 ? 0 : 1);
