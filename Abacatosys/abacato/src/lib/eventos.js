/**
 * O que aconteceu no sistema, para quem administra poder olhar.
 *
 * ==========================================================================================
 * REGISTRAR NUNCA PODE DERRUBAR NEM ATRASAR O QUE ESTAVA ACONTECENDO
 *
 * Um erro ao gravar um evento não é motivo para o quadro não ser criado, e esperar a gravação
 * não é motivo para a resposta demorar. Por isso o insert sai do caminho de quem está na tela
 * — e o erro é engolido de propósito.
 *
 * MAS SAIR DO CAMINHO NÃO PODE VIRAR NÃO ACONTECER, e foi exatamente o que aconteceu: a
 * primeira versão disparava a promessa e não a esperava, o que funciona no Node e FALHA no
 * Cloudflare Worker. Lá o isolate para de executar quando a resposta sai, e a promessa
 * pendente é descartada no meio. O teste contra produção mostrou dois tipos de evento sumindo
 * — "bateu_limite" e "pediu_cadastro" — enquanto os mesmos testes passavam contra o servidor
 * local. Nenhum erro em lugar nenhum: o diário só ficava com buracos.
 *
 * `after()` é a resposta certa: o Next entrega a resposta e SÓ ENTÃO roda o que está aqui,
 * pedindo à plataforma que segure o isolate (é o `waitUntil` do Worker, por baixo). Fora de um
 * pedido — num script, num teste — `after()` não existe, e aí o disparo solto serve.
 * ==========================================================================================
 *
 * O QUE NÃO ENTRA AQUI: conteúdo. O evento guarda que fulano criou um quadro chamado X, e
 * nunca o que está dentro dele. Um diário que copia conteúdo vira um segundo lugar de onde
 * vazar a mesma coisa, com metade do cuidado.
 */

import { after } from "next/server";
import { supabase } from "./supabase.js";

export const TIPOS_DE_EVENTO = {
  entrou: "entrou",
  criouConta: "criou_conta",
  pediuCadastro: "pediu_cadastro",
  aprovouConta: "aprovou_conta",
  recusouConta: "recusou_conta",
  criouQuadro: "criou_quadro",
  criouProjeto: "criou_projeto",
  enviouDocumento: "enviou_documento",
  compartilhou: "compartilhou",
  bateuLimite: "bateu_limite",
};

/**
 * Anota um evento. NÃO espera a gravação.
 *
 * Devolve nada de propósito: quem chama não tem o que fazer com o resultado, e um `await`
 * aqui só serviria para atrasar a resposta de quem está na tela.
 */
export function anotar({ usuarioId, tipo, alvo, alvoId, detalhe }) {
  const gravar = () => supabase.from("abacato_eventos").insert({
    usuario_id: usuarioId || null,
    tipo,
    alvo: alvo ? String(alvo).slice(0, 200) : null,
    alvo_id: alvoId || null,
    detalhe: detalhe || null,
  }).then(() => {}, () => {});

  try {
    // Depois da resposta, com o isolate segurado pela plataforma.
    after(gravar);
  } catch {
    // Fora de um pedido (script, teste). Aqui não há resposta para atrapalhar, e o processo
    // vive até a promessa terminar.
    try { gravar(); } catch { /* nem a montagem do insert pode derrubar quem chamou */ }
  }
}

/** Atalho para o caso mais importante do diário: alguém esbarrou num limite.
 *
 *  É o evento que diz a quem administra que uma conta precisa de mais espaço — e é o único
 *  jeito de saber disso sem a pessoa escrever pedindo. */
export function anotarLimite({ usuarioId, limite, teto, usado }) {
  anotar({
    usuarioId,
    tipo: TIPOS_DE_EVENTO.bateuLimite,
    alvo: limite,
    detalhe: { limite, teto, usado },
  });
}
