// A parte da recorrência que fala com o banco. A regra em si mora em src/dominio/recorrencia.js
// e não sabe que banco existe — esta é a camada fina entre as duas.

import { supabase } from "./supabase.js";
import { ocorrenciasVencidas, proximaOcorrencia } from "@/dominio/recorrencia.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

/**
 * Transforma em cards as ocorrências que já venceram, e adianta o relógio de cada regra.
 *
 * Chamada ao abrir o quadro. Devolve quantos cards nasceram, para a tela poder avisar em vez
 * de o card simplesmente aparecer do nada.
 *
 * A proteção contra duplicar é o índice único `(origem, origem_id)` do esquema: cada ocorrência
 * carrega `origem_id = <id da regra>@<data>`. Duas abas abertas ao mesmo tempo disparam os dois
 * inserts, e o segundo bate no índice em vez de criar um card gêmeo. Conferir antes com um
 * `select` não resolveria — entre o select e o insert cabe a outra aba.
 */
export async function materializarRecorrencias(quadroId, agora = new Date()) {
  const { data: colunas } = await supabase
    .from("abacato_colunas").select("id").eq("quadro_id", quadroId).eq("arquivada", false);
  const ids = (colunas || []).map((c) => c.id);
  if (!ids.length) return 0;

  const { data: regras } = await supabase
    .from("abacato_recorrencias")
    .select("id, coluna_id, titulo, descricao, regra, proxima_em, ativa")
    .in("coluna_id", ids)
    .eq("ativa", true)
    .lte("proxima_em", agora.toISOString());

  if (!regras?.length) return 0;

  let criados = 0;
  for (const r of regras) {
    const { vencidas, proxima } = ocorrenciasVencidas(r.regra, r.proxima_em, agora);
    if (!vencidas.length) continue;

    // Posição: no topo da coluna. Uma tarefa que venceu hoje enterrada embaixo de trinta
    // cards é uma tarefa que ninguém vê.
    const { data: primeiro } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", r.coluna_id).eq("arquivado", false)
      .order("posicao").limit(1).maybeSingle();

    let posicao = posicaoEntre(null, primeiro?.posicao ?? null);
    for (const quando of vencidas) {
      const { error } = await supabase.from("abacato_cards").insert({
        coluna_id: r.coluna_id,
        titulo: r.titulo,
        descricao: r.descricao || null,
        posicao,
        fim_em: quando.toISOString(),
        origem: "recorrencia",
        origem_id: `${r.id}@${quando.toISOString().slice(0, 10)}`,
      });
      // 23505 é a violação do índice único: outra aba já criou este mesmo card. Não é erro,
      // é o índice fazendo o trabalho dele.
      if (!error) criados++;
      else if (error.code !== "23505") throw new Error(error.message);
      posicao -= 1;
    }

    if (proxima) {
      await supabase.from("abacato_recorrencias")
        .update({ proxima_em: proxima.toISOString() }).eq("id", r.id);
    } else {
      // Regra que não sabe dizer a próxima data está quebrada. Desligar é melhor que deixá-la
      // disparando o mesmo card a cada abertura do quadro.
      await supabase.from("abacato_recorrencias").update({ ativa: false }).eq("id", r.id);
    }
  }

  return criados;
}

/** A primeira data de uma regra recém-criada: a próxima ocorrência a partir de agora. */
export function primeiraOcorrencia(regra, agora = new Date()) {
  // Um passo para trás para que "toda segunda", criada numa segunda, comece HOJE e não daqui a
  // uma semana. `proximaOcorrencia` é estrita de propósito; o ajuste é aqui.
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  return proximaOcorrencia(regra, ontem);
}
