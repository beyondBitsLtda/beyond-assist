// O REINO DE TESTE (23/10/2026: "faça o modo teste em um modo de reino à parte, com um reino teste
// onde tudo é liberado, onde pode atacar outros reinos teste para testar tudo que é possível no
// jogo"). Puro: como nasce o reino de teste, os rivais-robô e as ferramentas. Onde ele é gravado
// (as tabelas gêmeas proof_teste_*) está em src/lib/mundo.js.
//
// As REGRAS do jogo são as mesmas do mundo de verdade (é para testar o jogo de verdade). O que muda
// no mundo de teste: o reino nasce com tudo liberado e 100.000 moedas; o saldo é só o livro-caixa
// do teste (os pontos de estudo não entram); não há escudo de novato; todo testador conta como quem
// tem a ofensiva para votar na paz; a bolsa negocia a qualquer hora (e na hora simulada); e há
// ferramentas para zerar os limites do dia, restaurar os rivais e recomeçar.

import { CONSTRUCOES, ORDEM_DAS_CONSTRUCOES, NIVEIS_INICIAIS, exercitoDeTreino, guarnicaoDeTreino, nivelMaximoDoNeuro } from "./reino.js";
import { ORDEM_DOS_VEICULOS } from "./veiculos.js";
import { ORDEM_DOS_PERSONAGENS, PERSONAGENS_DE_TODOS } from "./personagens.js";
import { OPERARIOS_INICIAIS, vagasDaMina } from "./ouro.js";

export const MUNDO_DE_TESTE = "teste";
export const MOEDAS_INICIAIS_DE_TESTE = 100_000;
export const MOEDAS_DE_TESTE = 10_000;     // o botão "+moedas"
export const SALDO_DOS_RIVAIS = 5_000;     // o cofre dos robôs (dá saque de verdade nas invasões)
export const NOME_DO_REINO_DE_TESTE = "Reino de Teste";

/**
 * Os rivais do mundo de teste: cinco reinos-robô, do mais fraco ao mais forte, para sempre haver
 * em quem atacar (os reinos de teste de outras pessoas aparecem também). Os ids são fixos — o
 * mesmo robô para todo mundo — e só existem nas tabelas de teste.
 */
export const RIVAIS_DE_TESTE = [
  { id: "7e57b070-0000-4000-8000-000000000001", nome: "Vila de Lata", dono: "🤖 Robô Lata", nivel: 1, trofeus: 20, oferta: { quantidade: 2, preco: 8 } },
  { id: "7e57b070-0000-4000-8000-000000000002", nome: "Forte de Cobre", dono: "🤖 Robô Cobre", nivel: 2, trofeus: 150, oferta: { quantidade: 3, preco: 15 } },
  { id: "7e57b070-0000-4000-8000-000000000003", nome: "Cidadela de Ferro", dono: "🤖 Robô Ferro", nivel: 3, trofeus: 320, oferta: { quantidade: 4, preco: 25 } },
  { id: "7e57b070-0000-4000-8000-000000000004", nome: "Bastião de Aço", dono: "🤖 Robô Aço", nivel: 4, trofeus: 600, oferta: null },
  { id: "7e57b070-0000-4000-8000-000000000005", nome: "Trono de Titânio", dono: "🤖 Robô Titânio", nivel: 5, trofeus: 1000, oferta: null },
];
export const rivalDeTeste = (id) => RIVAIS_DE_TESTE.find((r) => r.id === id) || null;
export const ehRivalDeTeste = (id) => Boolean(rivalDeTeste(id));

/**
 * As construções de um robô de nível 1 a 5: tudo perto do nível dele (as defesas um nível abaixo —
 * o Robô Lata não tem nenhuma, para haver um alvo de defesa "média"), e a terra nova só com o Terreno.
 */
function construcoesDoNivel(k) {
  const terreno = Math.max(0, Math.min(CONSTRUCOES.terreno.max, k - 2));
  const construcoes = {};
  for (const c of ORDEM_DAS_CONSTRUCOES) {
    const d = CONSTRUCOES[c];
    const nivel = c === "terreno" ? terreno
      : d.terreno ? (terreno >= d.terreno ? k - 1 - d.terreno : 0)
      : ["cofre", "muralha", "torre", "canhao"].includes(c) ? k - 1
      : k;
    construcoes[c] = Math.max(NIVEIS_INICIAIS[c] || 0, Math.min(d.max, nivel));
  }
  return construcoes;
}

/** O reino de um robô, inteiro: construções, Neuro, defesa e um exército (para ele também poder invadir). */
export function reinoDoRival(rival) {
  const k = rival.nivel;
  const construcoes = construcoesDoNivel(k);
  return {
    nome: rival.nome,
    construcoes,
    neuro_nivel: Math.min(nivelMaximoDoNeuro(construcoes.castelo), 2 * k - 1),
    exercito: exercitoDeTreino(construcoes.quartel, 0.8),
    guarnicao: guarnicaoDeTreino(construcoes.castelo, Math.min(1, 0.2 * k)),
    veiculos: ["barco"],
    operarios: vagasDaMina(construcoes.minaDeOuro),
    personagem: "robo",
    personagens: personagensDeTodosMais("robo"),
    trofeus: rival.trofeus,
    escudo_ate: null,
  };
}

const personagensDeTodosMais = (...outros) => [...new Set([...PERSONAGENS_DE_TODOS, ...outros])];

/** Tudo liberado: construções e Neuro no máximo, todos os veículos e personagens, tropas e operários cheios. */
export function reinoLiberado() {
  const construcoes = Object.fromEntries(ORDEM_DAS_CONSTRUCOES.map((c) => [c, CONSTRUCOES[c].max]));
  return {
    construcoes,
    neuro_nivel: nivelMaximoDoNeuro(construcoes.castelo),
    veiculos: [...ORDEM_DOS_VEICULOS],
    personagens: [...ORDEM_DOS_PERSONAGENS],
    exercito: exercitoDeTreino(construcoes.quartel, 1),
    guarnicao: guarnicaoDeTreino(construcoes.castelo, 1),
    operarios: vagasDaMina(construcoes.minaDeOuro),
  };
}

/** Um reino de teste do zero: como um reino novo de verdade (só o Barco), para testar a subida. */
export function reinoNovoDeTeste() {
  return {
    construcoes: { ...NIVEIS_INICIAIS },
    neuro_nivel: 1,
    veiculos: ["barco"],
    personagem: "neuro",
    personagens: [...PERSONAGENS_DE_TODOS],
    exercito: {},
    guarnicao: {},
    operarios: OPERARIOS_INICIAIS,
  };
}

/** As ferramentas do Reino de Teste (a tela mostra nesta ordem; o servidor só aceita estas). */
export const FERRAMENTAS_DE_TESTE = [
  { id: "moedas", emoji: "💰", titulo: `+${MOEDAS_DE_TESTE.toLocaleString("pt-BR")} moedas`, texto: "para testar compras, a bolsa e o aluguel" },
  { id: "dia", emoji: "🔄", titulo: "Recomeçar o dia", texto: "tanques cheios e as invasões de novo (apaga as expedições, as cargas e as suas invasões de hoje)" },
  { id: "rivais", emoji: "🤖", titulo: "Restaurar os rivais", texto: "os reinos-robô inteiros de novo, com cofre cheio e sem escudo" },
  { id: "invasao", emoji: "🛡️", titulo: "Um rival invade você", texto: "para testar a defesa, o saque perdido e o replay" },
  { id: "minas", emoji: "⏩", titulo: "Adiantar as minas", texto: "+24 h de trabalho: ouro, diamantes e moedas para coletar" },
  { id: "guerra", emoji: "⚔️", titulo: "Acabar com a paz", texto: "encerra a paz ou a votação do mundo de teste" },
  { id: "liberado", emoji: "🏰", titulo: "Tudo liberado de novo", texto: "construções, Neuro, veículos, personagens, tropas e operários no máximo" },
  { id: "zerar", emoji: "🌱", titulo: "Recomeçar do zero", texto: `um reino novo (só o Barco, níveis iniciais) com ${MOEDAS_INICIAIS_DE_TESTE.toLocaleString("pt-BR")} moedas`, confirmar: "Apagar o seu Reino de Teste e começar um do zero? O reino de verdade não muda." },
];

/** A url de uma rota do reino no mundo escolhido: `/api/reino` → `/api/reino?mundo=teste`. */
export function urlNoMundo(url, mundo) {
  if (mundo !== MUNDO_DE_TESTE) return url;
  return `${url}${url.includes("?") ? "&" : "?"}mundo=${MUNDO_DE_TESTE}`;
}
