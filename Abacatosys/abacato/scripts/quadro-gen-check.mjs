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
import { validarProposta, resumirProposta, LIMITES, pareceEstudo, citaMaterial, cardsSemMaterial } from "../src/dominio/quadroGen.js";

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

    // Uma descrição válida, para os casos que testam OUTRA coisa. Sem ela, todo caso daqui
    // para baixo falharia pela exigência de descrição em vez de pelo motivo que ele testa —
    // e um teste que falha pelo motivo errado não prova nada.
    const DESC = "Uma descrição de verdade, com o que é e como saber que terminou.";

    // Card apontando para coluna que não existe cai na primeira — a fila.
    const colunaTorta = validarProposta({
      nome: "X", colunas: [{ nome: "A fazer" }, { nome: "Feito" }],
      cards: [{ titulo: "Solto", coluna: "Inventada", descricao: DESC }],
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
      cards: Array.from({ length: LIMITES.cards + 5 }, (_, i) => ({ titulo: `t${i}`, coluna: "A", descricao: DESC })),
    });
    conferir("um quadro grande demais é recusado", !gigante.ok, gigante.erros.join("; "));

    // DESCRIÇÃO É OBRIGATÓRIA, e o mínimo existe porque o modelo, pressionado a preencher,
    // repete o título com outras palavras.
    const semDesc = validarProposta({
      nome: "X", colunas: [{ nome: "A" }],
      cards: [{ titulo: "Arrays e métodos", coluna: "A" }],
    });
    conferir("card sem descrição é recusado", !semDesc.ok, semDesc.erros.join("; "));

    const descCurta = validarProposta({
      nome: "X", colunas: [{ nome: "A" }],
      cards: [{ titulo: "Arrays e métodos", coluna: "A", descricao: "Arrays." }],
    });
    conferir("descrição que só repete o título também é recusada", !descCurta.ok);
    conferir("e o erro diz QUAIS cards", descCurta.erros.join(";").includes("Arrays e métodos"),
      descCurta.erros.join("; "));

    const boa = validarProposta({
      nome: "Obras", colunas: [{ nome: "A fazer" }, { nome: "Executando" }],
      etiquetas: [{ nome: "Urgente", cor: "#EF4444" }],
      cards: [{
        titulo: "Medir o terreno", coluna: "A fazer", etiqueta: "Urgente", prazoEmDias: 3,
        descricao: "Levantamento com trena a laser das divisas e desníveis. Sem isso o projeto " +
          "não fecha. Pronto quando as medidas estiverem no croqui assinado.",
        checklist: ["Agendar com o cliente", "Levar trena e nível", "Passar as medidas para o croqui"],
      }],
    });
    conferir("uma proposta completa passa", boa.ok, resumirProposta(boa.proposta));
    conferir("e o prazo em dias sobrevive", boa.proposta.cards[0].prazoEmDias === 3);
    conferir("a checklist sobrevive", boa.proposta.cards[0].checklist.length === 3);

    const listaEnorme = validarProposta({
      nome: "X", colunas: [{ nome: "A" }],
      cards: [{
        titulo: "T", coluna: "A",
        descricao: "Uma descrição suficientemente longa para passar na conferência mínima.",
        checklist: Array.from({ length: 30 }, (_, i) => `passo ${i}`),
      }],
    });
    conferir("checklist gigante é cortada no limite, não recusada",
      listaEnorme.ok && listaEnorme.proposta.cards[0].checklist.length === LIMITES.itensDeChecklist,
      `${listaEnorme.proposta?.cards[0]?.checklist?.length}`);

    // A regra de "quadro de estudo pede material" é heurística, e uma heurística que ninguém
    // testa é uma heurística que ninguém sabe se funciona.
    conferir("reconhece um quadro de estudo", pareceEstudo("Plano de estudos de JavaScript"));
    conferir("reconhece por outras palavras", pareceEstudo("preparação para o concurso"));
    conferir("e não chama de estudo o que não é", !pareceEstudo("Obras dos clientes"));

    conferir("uma descrição com livro conta como material",
      citaMaterial("Leia o capítulo 4 do livro Eloquent JavaScript."));
    conferir("uma com documentação também", citaMaterial("Ver a referência de Array na MDN."));
    conferir("e uma sem fonte nenhuma não conta",
      !citaMaterial("Entenda bem como funcionam os arrays e pratique bastante."));
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

    // A exigência que o usuário pediu: card sem descrição não passa. A rota tem uma segunda
    // chance embutida — se o modelo largar títulos soltos, ela devolve e pede de novo.
    if (proposta) {
      const curtas = proposta.cards.filter((c) => !c.descricao || c.descricao.length < 25);
      conferir("TODO card veio com descrição", curtas.length === 0,
        curtas.map((c) => c.titulo).join(", ") || `${proposta.cards.length} card(s) descritos`);
      conferir("a descrição não é o título repetido",
        proposta.cards.every((c) => c.descricao.toLowerCase().trim() !== c.titulo.toLowerCase().trim()));
    }

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

    // As descrições e as checklists precisam chegar ao BANCO, e não só à prévia.
    const comDescricao = (cards || []).filter((c) => c.titulo && c.id);
    const { data: descritos } = await sb.from("abacato_cards")
      .select("titulo, descricao").in("id", comDescricao.map((c) => c.id));
    conferir("as descrições foram gravadas",
      (descritos || []).every((c) => c.descricao && c.descricao.length >= 25),
      (descritos || []).filter((c) => !c.descricao).map((c) => c.titulo).join(", ") || "todas");

    const esperadas = proposta.cards.filter((c) => c.checklist?.length).length;
    if (esperadas) {
      const { data: listas } = await sb.from("abacato_checklists")
        .select("id, card_id, titulo").in("card_id", comDescricao.map((c) => c.id));
      conferir("as checklists foram criadas", listas?.length === esperadas,
        `${listas?.length} de ${esperadas}`);

      const { count: itens } = await sb.from("abacato_checklist_itens")
        .select("id", { count: "exact", head: true })
        .in("checklist_id", (listas || []).map((l) => l.id));
      const esperadosItens = proposta.cards.reduce((n, c) => n + (c.checklist?.length || 0), 0);
      conferir("com todos os passos dentro", itens === esperadosItens,
        `${itens} de ${esperadosItens}`);

      const { data: primeiro } = await sb.from("abacato_checklist_itens")
        .select("feito").in("checklist_id", (listas || []).map((l) => l.id)).limit(5);
      // Um passo já marcado faria o card nascer parecendo meio feito.
      conferir("e todos desmarcados", (primeiro || []).every((i) => i.feito === false));
    }
  }

  // ------------------------------------------------------- o caso de estudo
  secao("Assunto de estudo aponta material concreto");
  {
    const r = await chamar(s, "POST", "/api/quadro-gen", {
      mensagens: [{
        quem: "pessoa",
        texto: `Monte agora um quadro de estudos de JavaScript para quem está começando. ` +
          `Etapas: A estudar, Estudando, Praticando, Dominado. Quatro tópicos iniciais. ` +
          `Não me pergunte nada, proponha.`,
      }],
      fusoMinutos: 180,
    });
    const p = r.dados?.proposta;
    conferir("propôs o quadro de estudos", Boolean(p), p ? resumirProposta(p) : r.dados?.texto?.slice(0, 70));

    if (p) {
      const texto = p.cards.map((c) => `${c.descricao}`).join(" \n ");
      // Material concreto: nome de livro, de site de documentação, de curso. A busca é por
      // sinais, e não por uma lista fechada — a ideia é que a descrição aponte para ALGO.
      const citaMaterial = /MDN|livro|cap[íi]tulo|documenta|Eloquent|You Don'?t Know|curso|freeCodeCamp|JavaScript\.info|ECMA/i.test(texto);
      conferir("as descrições apontam material concreto", citaMaterial,
        texto.slice(0, 150).replace(/\s+/g, " "));

      const comPassos = p.cards.filter((c) => c.checklist?.length).length;
      conferir("e os cards trazem passos", comPassos > 0, `${comPassos} de ${p.cards.length}`);
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
        cards: Array.from({ length: 200 }, (_, i) => ({ titulo: `t${i}`, coluna: "A", descricao: "Uma descricao de verdade, com o que e e como saber que terminou." })),
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
