// Prova que a indexação não alcança as chaves reservadas para a conversa.
//
// Isto existe porque a falha que motivou a reserva foi SILENCIOSA: nada quebrou, nada deu
// erro, nenhum log reclamou. O sync simplesmente consumiu a cota diária das 35 chaves de
// embedding e a Lisa passou a levar 98 segundos para responder — esperando por uma chave
// livre que não existia. Uma regressão aqui teria exatamente a mesma cara, e é justamente
// por isso que ela precisa de teste.
//
// Roda sem rede e sem banco: o módulo de saúde só consulta o Supabase para reidratar o
// cache, e falhar essa consulta é um caminho previsto (ele segue com o que tem em memória).

import { pickKeyIndex, tamanhoDaReserva } from "../src/lib/geminiKeyHealth.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

const N = 35;
const RESERVA = tamanhoDaReserva();
const PRIMEIRA_RESERVADA = N - RESERVA;
const MODELO = "gemini-embedding-001";

console.log(`\npool de ${N} chaves · reserva de ${RESERVA} · a indexação só pode usar 0..${PRIMEIRA_RESERVADA - 1}`);

console.log("\n1) a indexação nunca alcança a reserva");
{
  const vistas = new Set();
  // Muito mais voltas que o tamanho do pool: se houver qualquer caminho que escape do
  // limite, o rodízio encontra ele.
  for (let i = 0; i < N * 12; i++) vistas.add(await pickKeyIndex(N, MODELO, new Set(), { paraIngestao: true }));
  const invasoras = [...vistas].filter((i) => i >= PRIMEIRA_RESERVADA);
  conferir("nenhuma chave reservada foi entregue à indexação", invasoras.length === 0, `entregou ${invasoras}`);
  conferir("e ela usa todas as que lhe cabem", vistas.size === PRIMEIRA_RESERVADA, `usou ${vistas.size} de ${PRIMEIRA_RESERVADA}`);
}

console.log("\n2) a conversa continua com o pool inteiro");
{
  const vistas = new Set();
  for (let i = 0; i < N * 12; i++) vistas.add(await pickKeyIndex(N, MODELO, new Set()));
  conferir("a conversa alcança as 35", vistas.size === N, `alcançou ${vistas.size}`);
  conferir("inclusive as reservadas", [...vistas].some((i) => i >= PRIMEIRA_RESERVADA));
}

console.log("\n3) o caso que derrubou a Lisa: indexação com tudo dela esgotado");
{
  // Simula o mundo real de 15/09: todas as chaves que a indexação pode usar já excluídas
  // nesta mesma chamada. Mesmo assim ela não pode invadir a reserva — a resposta certa é
  // insistir nas próprias, não roubar as da conversa.
  const todasDela = new Set(Array.from({ length: PRIMEIRA_RESERVADA }, (_, i) => i));
  const escolhas = new Set();
  for (let i = 0; i < 60; i++) escolhas.add(await pickKeyIndex(N, MODELO, todasDela, { paraIngestao: true }));
  const invadiu = [...escolhas].filter((i) => i >= PRIMEIRA_RESERVADA);
  conferir("mesmo sem opção, a indexação não invade a reserva", invadiu.length === 0, `invadiu ${invadiu}`);
}

console.log("\n4) reserva maior que o pool não trava a indexação");
{
  // Configuração absurda não pode virar "a indexação para de funcionar". Com um pool de 3 e
  // reserva de 8, ela ainda precisa de pelo menos uma chave: indexar devagar é melhor que
  // não indexar.
  const escolha = await pickKeyIndex(3, MODELO, new Set(), { paraIngestao: true });
  conferir("com pool menor que a reserva, ainda devolve uma chave válida", Number.isInteger(escolha) && escolha >= 0 && escolha < 3, `devolveu ${escolha}`);
}

console.log("\n5) os dois rodízios são independentes");
{
  // Se compartilhassem o ponteiro, o sync (milhares de chamadas) decidiria sozinho onde a
  // próxima pergunta do usuário começa — e concentraria a conversa sempre nas mesmas chaves.
  const a = await pickKeyIndex(N, MODELO, new Set());
  for (let i = 0; i < 17; i++) await pickKeyIndex(N, MODELO, new Set(), { paraIngestao: true });
  const b = await pickKeyIndex(N, MODELO, new Set());
  conferir("17 chamadas de indexação não movem o ponteiro da conversa", b === (a + 1) % N, `esperado ${(a + 1) % N}, veio ${b}`);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
