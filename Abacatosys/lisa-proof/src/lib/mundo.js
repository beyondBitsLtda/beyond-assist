// O MUNDO DE TESTE (23/10/2026). Pedido: "o modo teste é simplesmente teste — faça o modo teste em
// um modo de reino à parte, com um reino teste onde tudo é liberado, onde pode atacar outros reinos
// teste para testar tudo que é possível no jogo". O modo de teste antigo mexia no reino de verdade
// (deu veículos e combustível de graça, e com eles expedições que valeram moedas de verdade).
//
// Agora o jogo tem dois mundos com as MESMAS regras e o MESMO código: o de verdade e o de teste. O
// que muda é onde se grava: no mundo de teste, cada tabela do jogo vira a sua gêmea `proof_teste_*`
// (db/016-mundo-de-teste.sql). Nada do que acontece lá toca o reino de verdade — nem moedas, nem
// expedições, nem a carteira da bolsa, nem o ranking.
//
// O mundo vem do pedido (?mundo=teste) e vale para a requisição inteira (AsyncLocalStorage): o
// código do reino não precisa saber em que mundo está — ele só fala com o banco por `db`. O que é
// do mundo todo e não muda com o teste (as ações e os preços da bolsa, os pontos de estudo, os
// nomes) continua nas tabelas de sempre.
//
// REGRA: toda tabela do jogo nova (ou coluna nova numa delas) ganha a gêmea de teste na mesma
// migração e entra em TABELAS_DO_MUNDO. scripts/dominio-check.mjs barra `supabase.` direto em
// src/lib/reino.js e src/lib/bolsa.js — lá, tudo passa por `db`.

import { AsyncLocalStorage } from "node:async_hooks";
import { supabase } from "./supabase.js";
import { ErroDeAcesso, respostaDeErro } from "./sessao.js";

/** As tabelas que cada mundo tem a sua: o reino, o livro-caixa, as batalhas, a paz, os operários e a carteira da bolsa. */
export const TABELAS_DO_MUNDO = [
  "proof_reinos", "proof_reino_movimentos", "proof_invasoes", "proof_expedicoes", "proof_pazes", "proof_paz_votos",
  "proof_operarios_ofertas", "proof_alugueis", "proof_bolsa_posicoes", "proof_bolsa_ordens",
];
const DO_MUNDO = new Set(TABELAS_DO_MUNDO);
const contexto = new AsyncLocalStorage();

/** O Reino de Teste existe? Desliga com PROOF_MODO_TESTE=0 na hospedagem. */
export const modoDeTesteLigado = () => process.env.PROOF_MODO_TESTE !== "0";
export const emTeste = () => contexto.getStore() === "teste";
export const mundoAtual = () => (emTeste() ? "teste" : "real");

/** O nome da tabela no mundo de agora: `proof_reinos` vira `proof_teste_reinos` no mundo de teste. */
export const tabela = (nome) => (emTeste() && DO_MUNDO.has(nome) ? nome.replace(/^proof_/, "proof_teste_") : nome);

/** O banco do mundo de agora (o mesmo `from` do supabase, com a tabela trocada no mundo de teste). */
export const db = { from: (nome) => supabase.from(tabela(nome)) };

/** Roda `fn` num mundo ("real" ou "teste"). */
export function noMundo(mundo, fn) {
  return contexto.run(mundo === "teste" ? "teste" : "real", fn);
}

/** O mundo que o pedido escolheu (?mundo=teste); o de verdade é o padrão. */
export function mundoDoPedido(req) {
  if (new URL(req.url).searchParams.get("mundo") !== "teste") return "real";
  if (!modoDeTesteLigado()) throw new ErroDeAcesso(403, "o Reino de Teste está desligado");
  return "teste";
}

/** Uma rota do reino que serve aos dois mundos: tudo o que ela faz fica no mundo do pedido. */
export function rotaDoMundo(handler) {
  return (req, ctx) => {
    let mundo;
    try {
      mundo = mundoDoPedido(req);
    } catch (e) {
      return respostaDeErro(e);
    }
    return noMundo(mundo, () => handler(req, ctx));
  };
}
