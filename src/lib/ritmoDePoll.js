// Ritmo de consulta entre dois aparelhos — o jogo do disco e o Modo Deus do Mundo da Lisa.
//
// Os dois perguntam ao servidor "chegou sinal?" num laço. Perguntar a cada 0,7 s é o que faz o
// disco sair de uma tela e cair na outra sem atraso perceptível, e isso precisa continuar
// valendo ENQUANTO alguém está jogando.
//
// O problema é o resto do tempo. Uma aba esquecida aberta a 0,7 s são 123 mil chamadas por dia
// — mais que a cota diária inteira do plano gratuito da Cloudflare, gasta sem ninguém usando
// nada. E quando ela estoura, TODOS os painéis param até a virada do dia.
//
// A saída é o ritmo variar: rápido quando está acontecendo alguma coisa, desacelerando sozinho
// quando não chega nada, e voltando ao rápido no primeiro sinal. Quem joga não percebe
// diferença; a aba esquecida passa a custar uns 10 mil por dia em vez de 123 mil.

/**
 * @param {object} opts
 * @param {number} opts.rapido   intervalo enquanto há atividade (ms)
 * @param {number} opts.lento    teto de desaceleração (ms)
 * @param {number} [opts.fator]  quanto o intervalo cresce a cada rodada vazia
 */
export function criarRitmo({ rapido, lento, fator = 1.6 }) {
  let atual = rapido;
  return {
    /** Quanto esperar até a próxima consulta. */
    get intervalo() {
      return atual;
    },
    /** Chame com o número de sinais recebidos. Zero desacelera; qualquer coisa acorda. */
    registrar(quantidade) {
      atual = quantidade > 0 ? rapido : Math.min(lento, Math.round(atual * fator));
      return atual;
    },
    /** Volta ao ritmo rápido na hora — use quando o próprio usuário age (jogou o disco,
     *  apertou um botão do Modo Deus): a resposta do outro aparelho vem logo em seguida. */
    acordar() {
      atual = rapido;
    },
  };
}

/**
 * A aba está visível?
 *
 * Aba em segundo plano não tem ninguém olhando, e continuar perguntando é queimar cota pra
 * atualizar uma tela que ninguém vê. Fora do navegador (build no servidor) devolve true, pra
 * não mudar comportamento onde essa noção não existe.
 */
export function abaVisivel() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}
