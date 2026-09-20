import { supabase } from "./supabase.js";
import { proximaOcorrencia } from "@/dominio/recorrencia.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

/**
 * Concluir um card que se repete faz nascer o PRÓXIMO.
 *
 * O caminho fácil seria mudar a data do mesmo card e desmarcar o concluído. Aí "quantas vezes
 * isso foi feito em agosto" deixa de ter resposta: existiria um card só, e ele só sabe a última
 * vez. Com um card novo a cada ciclo, o histórico é o próprio quadro.
 *
 * O novo nasce no lugar do antigo — mesma coluna, logo acima dele — com título, descrição,
 * etiquetas, responsáveis e checklists iguais. As checklists vêm DESMARCADAS: é trabalho a
 * fazer de novo, e trazer as marcas faria o ciclo novo nascer parecendo pronto.
 */
export async function gerarProximaOcorrencia(cardId) {
  const { data: card } = await supabase
    .from("abacato_cards")
    .select("id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, capa, recorrencia_regra")
    .eq("id", cardId).maybeSingle();

  if (!card?.recorrencia_regra) return null;

  // A base é o prazo do card que acabou de ser concluído. Sem prazo, é hoje — senão não haveria
  // de onde contar, e uma tarefa "toda segunda" sem data nunca saberia qual segunda.
  const base = card.fim_em ? new Date(card.fim_em) : new Date();
  const proxima = proximaOcorrencia(card.recorrencia_regra, base);
  if (!proxima) return null;

  // Já existe o próximo? Acontece ao desmarcar e marcar de novo, que é um clique comum. Sem
  // esta checagem, cada hesitação criaria um card.
  const { data: jaTem } = await supabase
    .from("abacato_cards")
    .select("id")
    .eq("coluna_id", card.coluna_id)
    .eq("titulo", card.titulo)
    .eq("arquivado", false)
    .eq("concluido", false)
    .eq("fim_em", proxima.toISOString())
    .maybeSingle();
  if (jaTem) return null;

  const deslocamento = card.inicio_em && card.fim_em
    ? new Date(card.fim_em).getTime() - new Date(card.inicio_em).getTime()
    : null;

  const { data: novo, error } = await supabase.from("abacato_cards").insert({
    coluna_id: card.coluna_id,
    titulo: card.titulo,
    descricao: card.descricao,
    // Logo acima do que acabou de ser concluído: é onde o olho já está.
    posicao: posicaoEntre(null, card.posicao),
    fim_em: proxima.toISOString(),
    // A distância entre começar e entregar é mantida: uma tarefa que se prepara três dias antes
    // continua se preparando três dias antes no ciclo seguinte.
    inicio_em: deslocamento != null ? new Date(proxima.getTime() - deslocamento).toISOString() : null,
    capa: card.capa,
    recorrencia_regra: card.recorrencia_regra,
    origem: "recorrencia",
  }).select("id, titulo, fim_em").single();
  if (error) throw new Error(error.message);

  // Etiquetas e responsáveis vão juntos: um card que se repete toda semana com as mesmas
  // etiquetas obrigaria a repor as etiquetas toda semana.
  const [etiquetas, responsaveis, checklists] = await Promise.all([
    supabase.from("abacato_card_etiquetas").select("etiqueta_id").eq("card_id", cardId),
    supabase.from("abacato_card_responsaveis").select("usuario_id").eq("card_id", cardId),
    supabase.from("abacato_checklists").select("id, titulo, posicao").eq("card_id", cardId).order("posicao"),
  ]);

  const tarefas = [];
  if (etiquetas.data?.length) {
    tarefas.push(supabase.from("abacato_card_etiquetas")
      .insert(etiquetas.data.map((e) => ({ card_id: novo.id, etiqueta_id: e.etiqueta_id }))));
  }
  if (responsaveis.data?.length) {
    tarefas.push(supabase.from("abacato_card_responsaveis")
      .insert(responsaveis.data.map((r) => ({ card_id: novo.id, usuario_id: r.usuario_id }))));
  }
  await Promise.all(tarefas);

  for (const cl of checklists.data || []) {
    const { data: nova } = await supabase.from("abacato_checklists")
      .insert({ card_id: novo.id, titulo: cl.titulo, posicao: cl.posicao }).select("id").single();
    const { data: itens } = await supabase.from("abacato_checklist_itens")
      .select("texto, posicao").eq("checklist_id", cl.id).order("posicao");
    if (nova && itens?.length) {
      await supabase.from("abacato_checklist_itens")
        .insert(itens.map((i) => ({ checklist_id: nova.id, texto: i.texto, feito: false, posicao: i.posicao })));
    }
  }

  // O card antigo para de se repetir: quem carrega a regra agora é o novo. Sem isto, concluir o
  // antigo de novo — depois de desmarcar, por exemplo — geraria um terceiro card.
  await supabase.from("abacato_cards").update({ recorrencia_regra: null }).eq("id", cardId);

  return novo;
}
