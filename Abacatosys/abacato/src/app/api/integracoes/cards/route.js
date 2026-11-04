import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { exigirIntegracao } from "@/lib/integracoes.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { acharDuplicado, LIMITES } from "@/dominio/integracao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/integracoes/cards   Authorization: Bearer abi_...
 * body: { titulo, descricao?, origem?, origemId?, site?, dedup?, apenasConferir? }
 *
 * Cria o card no FIM da coluna de entrada da integração — e só nela. A coluna não vem no
 * pedido: se viesse, um token do Beyond-Lead poderia jogar card em "Fechado" e inflar o
 * faturamento do mês.
 *
 * Com `dedup`, confere o quadro inteiro antes (ver `acharDuplicado`) e devolve 200 com
 * `duplicado` em vez de criar. Não é erro: é a resposta esperada metade das vezes numa
 * prospecção repetida, e um 409 encheria o log de quem chama de falsos problemas.
 *
 * `apenasConferir` faz só a conferência, sem criar. O Beyond-Lead pergunta ANTES de ler o site
 * da empresa e chamar o Gemini: gastar cota do modelo para enriquecer um lead que já existe é
 * dinheiro jogado fora. Na criação ele manda `dedup` de novo, porque entre a pergunta e o
 * pedido outra rodada pode ter criado o mesmo lead.
 */
export async function POST(req) {
  try {
    const { integracao, quadro } = await exigirIntegracao(req, "criar");
    const corpo = await req.json().catch(() => ({}));

    const titulo = String(corpo.titulo || "").trim().slice(0, LIMITES.titulo);
    if (!titulo) throw new ErroDeAcesso(400, "o card precisa de um título");
    const descricao = corpo.descricao ? String(corpo.descricao).slice(0, LIMITES.descricao) : null;
    // A origem é o nome da integração quando quem chama não diz outra. O índice único
    // (origem, origem_id) é o que segura duas chamadas simultâneas para o mesmo lead.
    const origem = String(corpo.origem || integracao.nome).slice(0, 60);
    const origemId = corpo.origemId ? String(corpo.origemId).slice(0, LIMITES.origemId) : null;

    // A coluna de entrada precisa continuar viva e dentro do quadro da integração. Alguém pode
    // ter arquivado a coluna depois de a integração ser criada; conferir custa uma consulta.
    const { data: coluna } = await supabase
      .from("abacato_colunas").select("id, quadro_id, arquivada")
      .eq("id", integracao.coluna_entrada_id).maybeSingle();
    if (!coluna || coluna.arquivada || coluna.quadro_id !== quadro.id) {
      throw new ErroDeAcesso(409, "a coluna de entrada da integração não está mais disponível");
    }

    if (corpo.dedup || corpo.apenasConferir) {
      // Todas as colunas do quadro, inclusive as arquivadas: um lead guardado numa coluna
      // encerrada continua sendo um lead que já passou por aqui.
      const { data: colunas } = await supabase
        .from("abacato_colunas").select("id").eq("quadro_id", quadro.id);
      const { data: cards, error } = await supabase
        .from("abacato_cards")
        .select("id, titulo, descricao, origem, origem_id")
        .in("coluna_id", (colunas || []).map((c) => c.id))
        .eq("arquivado", false);
      if (error) throw new ErroDeAcesso(500, error.message);

      const duplicado = acharDuplicado(cards, { titulo, site: corpo.site, origem, origemId });
      if (duplicado) return json({ ok: false, duplicado: { ...duplicado, quadroId: quadro.id } });
      if (corpo.apenasConferir) return json({ ok: true, duplicado: null });
    }

    const { data: ultimo } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", coluna.id).eq("arquivado", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("abacato_cards")
      .insert({
        coluna_id: coluna.id,
        titulo,
        descricao,
        posicao: posicaoEntre(ultimo?.posicao ?? null, null),
        origem,
        origem_id: origemId,
      })
      .select("id, titulo").single();

    if (error) {
      // 23505 = violou o índice único (origem, origem_id): outra chamada criou o mesmo lead
      // um instante antes. É um duplicado, não uma falha.
      if (error.code === "23505") {
        return json({ ok: false, duplicado: { titulo, motivo: "origem", quadroId: quadro.id } });
      }
      throw new ErroDeAcesso(500, error.message);
    }

    await tocarQuadro(quadro.id);
    return json({ ok: true, card: { id: data.id, titulo: data.titulo, quadroId: quadro.id } }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
