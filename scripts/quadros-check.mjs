// Exercita a troca de fonte dos quadros: Trello ou Abacato.
//
// O que precisa estar certo aqui não é "os dados vêm" — é que os dois lados devolvem a MESMA
// FORMA de card. Nove telas e rotas da Lisa leem esse formato, e nenhuma delas sabe de qual
// sistema ele veio. Se o Abacato devolvesse `due` como número em vez de texto, ou esquecesse
// o `board_id`, nada quebraria com erro: o Kanban ficaria sem colunas, as notificações
// parariam de disparar e o assistente diria que não há tarefas.
//
// Por isso a maior parte das conferências abaixo é sobre a forma, e não sobre o conteúdo.
//
// Uso:  npm run quadros-check

import { loadAllCards, esquecerCache } from "@/lib/liveQuadros.js";
import { fonteDosQuadros, gravarConfig, configFoiLida, FONTES_DE_QUADRO } from "@/lib/configLisa.js";

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok     ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA  ${t}${d ? `  — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// Os campos que as telas da Lisa leem. A lista é o contrato.
const CAMPOS = [
  "id", "board", "board_id", "title", "content", "last_modified",
  "list", "list_pos", "id_list", "url", "labels", "due", "start", "due_complete",
];

console.log("\nFonte dos quadros — Trello e Abacato\n");

const fonteOriginal = await fonteDosQuadros();
console.log(`1) o que está valendo agora: ${fonteOriginal}`);
conferir("a fonte configurada é uma das conhecidas", FONTES_DE_QUADRO.includes(fonteOriginal), fonteOriginal);

// Sem esta conferência, um banco fora do ar passaria por aqui como se estivesse tudo bem: o
// recuo devolve "trello" em silêncio, e "trello" é um valor perfeitamente válido. Aconteceu
// na primeira vez que este script rodou.
conferir("a configuração foi LIDA do banco, não é o padrão de emergência", await configFoiLida(),
  "o banco não respondeu — tudo abaixo estaria medindo o recuo, não o sistema");

// ------------------------------------------------------------------ as duas formas

const lados = {};
for (const fonte of FONTES_DE_QUADRO) {
  console.log(`\n2.${fonte === "trello" ? 1 : 2}) ler do ${fonte}`);
  try {
    const cards = await loadAllCards({ fonte, fresh: true });
    lados[fonte] = cards;
    ok(`leu sem erro`, `${cards.length} card(s)`);

    if (!cards.length) {
      // Não é falha: um Abacato recém-criado está vazio mesmo. Mas precisa ser DITO, senão as
      // conferências de forma abaixo passariam sem ter olhado um único card.
      console.log("  aviso  nenhum card — as conferências de formato abaixo não têm o que olhar");
      continue;
    }

    const c = cards[0];
    const faltando = CAMPOS.filter((campo) => !(campo in c));
    conferir("o card tem todos os campos do contrato", faltando.length === 0, `faltam: ${faltando.join(", ")}`);

    conferir("id é texto não vazio", typeof c.id === "string" && c.id.length > 0, typeof c.id);
    conferir("board é texto", typeof c.board === "string");
    conferir("title é texto", typeof c.title === "string" && c.title.length > 0);
    conferir("due_complete é booleano", typeof c.due_complete === "boolean", typeof c.due_complete);

    // `due` alimenta `new Date(...)` em pelo menos quatro lugares. Um número ou um formato
    // estranho não quebra: vira Invalid Date, e o card some silenciosamente das contas de
    // atrasado.
    const comPrazo = cards.filter((x) => x.due);
    if (comPrazo.length) {
      const todasValidas = comPrazo.every((x) => !Number.isNaN(new Date(x.due).getTime()));
      conferir("todo prazo é uma data que o JavaScript entende", todasValidas,
        `${comPrazo.length} card(s) com prazo`);
    } else {
      console.log("  aviso  nenhum card com prazo nesta fonte");
    }

    // `list_pos` ordena as colunas do Kanban. Texto em vez de número ordenaria "10" antes de
    // "9", e as colunas apareceriam fora de ordem sem nenhum erro.
    const comPos = cards.filter((x) => x.list_pos != null);
    if (comPos.length) {
      conferir("list_pos é número", comPos.every((x) => typeof x.list_pos === "number"),
        typeof comPos[0].list_pos);
    }

    // A URL é o que a Lisa cita nas respostas. Uma URL quebrada só aparece quando alguém clica.
    const comUrl = cards.filter((x) => x.url);
    if (comUrl.length) {
      const validas = comUrl.every((x) => /^https?:\/\//.test(x.url));
      conferir("as URLs são endereços http(s)", validas, comUrl[0].url);
    }

    const ids = new Set(cards.map((x) => x.id));
    conferir("os ids não se repetem", ids.size === cards.length, `${cards.length} cards, ${ids.size} ids`);
  } catch (e) {
    falha(`ler do ${fonte}`, String(e.message || e).slice(0, 160));
    lados[fonte] = null;
  }
}

// ------------------------------------------------------------------ as duas formas batem

console.log("\n3) as duas fontes falam a mesma língua");
if (lados.trello?.length && lados.abacato?.length) {
  const campos = (c) => Object.keys(c).sort().join(",");
  conferir("os cards têm exatamente os mesmos campos",
    campos(lados.trello[0]) === campos(lados.abacato[0]),
    `trello: ${campos(lados.trello[0])}\n         abacato: ${campos(lados.abacato[0])}`);

  const tipos = (c) => CAMPOS.map((k) => `${k}:${c[k] === null ? "null" : typeof c[k]}`).join(" ");
  const iguaisOuNulos = CAMPOS.every((k) => {
    const a = lados.trello[0][k], b = lados.abacato[0][k];
    return a === null || b === null || typeof a === typeof b;
  });
  conferir("e os mesmos tipos", iguaisOuNulos, `\n         trello:  ${tipos(lados.trello[0])}\n         abacato: ${tipos(lados.abacato[0])}`);
} else {
  console.log("  aviso  uma das fontes está vazia ou falhou — não dá para comparar as formas");
}

// ------------------------------------------------------------------ o interruptor

console.log("\n4) o interruptor troca mesmo o que a Lisa lê");
{
  const outra = fonteOriginal === "trello" ? "abacato" : "trello";
  try {
    await gravarConfig("fonte_dos_quadros", outra, "quadros-check");
    esquecerCache();
    conferir("a configuração mudou", (await fonteDosQuadros()) === outra, await fonteDosQuadros());

    if (lados[outra]) {
      const agora = await loadAllCards({ fresh: true });
      conferir("e a leitura padrão passou a vir da fonte nova",
        agora.length === lados[outra].length,
        `esperava ${lados[outra].length}, veio ${agora.length}`);
    }

    // Valor inventado no banco tem de cair no Trello — o padrão de uma configuração quebrada
    // é o comportamento antigo, nunca um erro nem o comportamento novo.
    await gravarConfig("fonte_dos_quadros", "sistema-que-nao-existe", "quadros-check");
    esquecerCache();
    conferir("valor inválido cai no trello", (await fonteDosQuadros()) === "trello");
  } finally {
    // Devolve como estava, aconteça o que acontecer. Um teste que deixa a Lisa apontando para
    // outro sistema é pior que um teste que falha.
    await gravarConfig("fonte_dos_quadros", fonteOriginal, "quadros-check (restaurado)");
    esquecerCache();
    const voltou = await fonteDosQuadros();
    conferir("a fonte original foi restaurada", voltou === fonteOriginal, `ficou em ${voltou}`);
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
