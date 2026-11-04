import { supabase } from "./supabase.js";
import { proximaOcorrencia } from "@/dominio/recorrencia.js";

/**
 * Concluir uma tarefa que se repete REPROGRAMA O MESMO CARD.
 *
 * Ele volta a ficar aberto, com a data seguinte, e as checklists voltam a ficar desmarcadas.
 * É o que se espera de uma tarefa recorrente: ela não "acaba", ela vira a próxima.
 *
 * A PRIMEIRA VERSÃO DISTO FAZIA OUTRA COISA, e estava errada. Ela criava um card NOVO e
 * deixava o antigo concluído no quadro, para guardar o histórico de cada ciclo. Funcionava, e
 * não era o que alguém quer ao marcar "conferir os backups" como feito: o card clicado
 * continuava riscado na tela e aparecia outro igual logo acima. A intenção é boa e a leitura
 * do quadro é pior.
 *
 * O histórico continua existindo, e sem atrapalhar: antes de reprogramar, uma cópia ARQUIVADA
 * do ciclo que acabou fica guardada, com as checklists do jeito que foram deixadas. Ela não
 * aparece no quadro e responde "isso foi feito na semana passada?" — que é a pergunta que a
 * reprogramação apagaria.
 */
export async function reprogramarCard(cardId) {
  const { data: card } = await supabase
    .from("abacato_cards")
    .select("id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, capa, recorrencia_regra")
    .eq("id", cardId).maybeSingle();

  if (!card?.recorrencia_regra) return null;

  // A base é o prazo que acabou de ser cumprido. Sem prazo, é hoje — senão não haveria de onde
  // contar, e uma tarefa "toda segunda" sem data nunca saberia qual segunda.
  const base = card.fim_em ? new Date(card.fim_em) : new Date();
  const proxima = proximaOcorrencia(card.recorrencia_regra, base);
  if (!proxima) return null;

  await guardarOCicloQueAcabou(card);

  // A distância entre começar e entregar é mantida: uma tarefa que se prepara três dias antes
  // continua se preparando três dias antes no ciclo seguinte.
  const deslocamento = card.inicio_em && card.fim_em
    ? new Date(card.fim_em).getTime() - new Date(card.inicio_em).getTime()
    : null;

  const { data: atualizado, error } = await supabase.from("abacato_cards").update({
    concluido: false,
    fim_em: proxima.toISOString(),
    inicio_em: deslocamento != null ? new Date(proxima.getTime() - deslocamento).toISOString() : card.inicio_em,
  }).eq("id", cardId).select("id, titulo, fim_em, inicio_em, concluido").single();
  if (error) throw new Error(error.message);

  // As checklists voltam a ficar desmarcadas: é trabalho a fazer de novo, e deixá-las marcadas
  // faria o ciclo novo nascer parecendo pronto.
  const { data: checklists } = await supabase
    .from("abacato_checklists").select("id").eq("card_id", cardId);
  if (checklists?.length) {
    await supabase.from("abacato_checklist_itens")
      .update({ feito: false })
      .in("checklist_id", checklists.map((c) => c.id));
  }

  return { ...atualizado, reprogramado: true };
}

/**
 * Uma cópia arquivada do ciclo que acabou.
 *
 * Arquivada, então não aparece no quadro. Guarda as checklists COMO FORAM DEIXADAS — é aí que
 * mora a informação: "na semana passada eu conferi os backups mas não testei a restauração".
 *
 * Falhar aqui não pode impedir a reprogramação: perder o registro de um ciclo é ruim, e deixar
 * a tarefa presa em "concluída" é pior.
 */
async function guardarOCicloQueAcabou(card) {
  try {
    const { data: copia } = await supabase.from("abacato_cards").insert({
      coluna_id: card.coluna_id,
      titulo: card.titulo,
      descricao: card.descricao,
      posicao: card.posicao,
      inicio_em: card.inicio_em,
      fim_em: card.fim_em,
      capa: card.capa,
      concluido: true,
      arquivado: true,
      origem: "ciclo",
    }).select("id").single();
    if (!copia) return;

    const [etiquetas, responsaveis, checklists] = await Promise.all([
      supabase.from("abacato_card_etiquetas").select("etiqueta_id").eq("card_id", card.id),
      supabase.from("abacato_card_responsaveis").select("usuario_id").eq("card_id", card.id),
      supabase.from("abacato_checklists").select("id, titulo, posicao").eq("card_id", card.id).order("posicao"),
    ]);

    const tarefas = [];
    if (etiquetas.data?.length) {
      tarefas.push(supabase.from("abacato_card_etiquetas")
        .insert(etiquetas.data.map((e) => ({ card_id: copia.id, etiqueta_id: e.etiqueta_id }))));
    }
    if (responsaveis.data?.length) {
      tarefas.push(supabase.from("abacato_card_responsaveis")
        .insert(responsaveis.data.map((r) => ({ card_id: copia.id, usuario_id: r.usuario_id }))));
    }
    await Promise.all(tarefas);

    for (const cl of checklists.data || []) {
      const { data: nova } = await supabase.from("abacato_checklists")
        .insert({ card_id: copia.id, titulo: cl.titulo, posicao: cl.posicao }).select("id").single();
      const { data: itens } = await supabase.from("abacato_checklist_itens")
        .select("texto, feito, posicao").eq("checklist_id", cl.id).order("posicao");
      if (nova && itens?.length) {
        await supabase.from("abacato_checklist_itens").insert(
          // `feito` como estava: o registro do ciclo é justamente o que foi e o que não foi feito.
          itens.map((i) => ({ checklist_id: nova.id, texto: i.texto, feito: i.feito, posicao: i.posicao }))
        );
      }
    }
  } catch {
    /* registro perdido; a reprogramação continua */
  }
}
