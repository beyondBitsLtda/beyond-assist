import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { respostaDeErro } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";
import { planoDe, medir, emTamanho } from "@/dominio/planos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/uso — o painel de quem administra: contas, o que cada uma criou, e o diário.
 *
 * ==========================================================================================
 * MOSTRA QUE EXISTE, E NÃO O QUE TEM DENTRO
 *
 * A lista de quadros traz nome, dono, data e quantos cards. NÃO traz os cards, nem as
 * descrições, nem os documentos. A diferença é a linha entre administrar e ler o trabalho
 * alheio: para saber se uma conta está usando o sistema basta saber que ela tem sete quadros;
 * abrir esses quadros é outra permissão, e ela continua sendo participação.
 *
 * Quem administra e precisa MESMO entrar num quadro se põe como membro — o que fica registrado
 * no diário, com nome e hora. É a versão que deixa rastro, em vez da que não deixa.
 * ==========================================================================================
 *
 * `?dias=` recorta o diário (padrão 30). `?pessoa=` filtra por conta.
 */
export async function GET(req) {
  try {
    await exigirAdmin(req);
    const url = new URL(req.url);
    const dias = Math.max(1, Math.min(365, Number(url.searchParams.get("dias")) || 30));
    const pessoa = url.searchParams.get("pessoa") || null;

    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const [contas, quadros, projetos, documentos, revisoes] = await Promise.all([
      supabase.from("abacato_usuarios")
        .select("id, nome, email, tipo, ativo, aprovado, admin, lisa, criado_em, ultimo_login")
        .order("criado_em", { ascending: false }),
      supabase.from("abacato_quadros")
        .select("id, nome, dono_id, arquivado, criado_em").order("criado_em", { ascending: false }),
      supabase.from("abacato_projetos")
        .select("id, nome, dono_id, arquivado, criado_em").order("criado_em", { ascending: false }),
      supabase.from("abacato_documentos").select("id, projeto_id"),
      supabase.from("abacato_revisoes").select("documento_id, tamanho"),
    ]);

    const pessoas = contas.data || [];
    const nomePorId = new Map(pessoas.map((p) => [p.id, p]));

    // Quantos cards cada quadro tem. Uma consulta só, agrupada aqui: pedir a contagem quadro a
    // quadro seria uma viagem ao banco por linha da tela.
    const idsDeQuadro = (quadros.data || []).map((q) => q.id);
    const cardsPorQuadro = new Map();
    if (idsDeQuadro.length) {
      const { data: colunas } = await supabase
        .from("abacato_colunas").select("id, quadro_id").in("quadro_id", idsDeQuadro);
      const quadroDaColuna = new Map((colunas || []).map((c) => [c.id, c.quadro_id]));
      const idsDeColuna = [...quadroDaColuna.keys()];
      for (let i = 0; i < idsDeColuna.length; i += 200) {
        const { data: cards } = await supabase.from("abacato_cards")
          .select("coluna_id").in("coluna_id", idsDeColuna.slice(i, i + 200)).eq("arquivado", false);
        for (const c of cards || []) {
          const q = quadroDaColuna.get(c.coluna_id);
          if (q) cardsPorQuadro.set(q, (cardsPorQuadro.get(q) || 0) + 1);
        }
      }
    }

    // Bytes por projeto, e daí por dono. Somando TODAS as revisões, que é o mesmo critério do
    // limite — um painel que conta diferente da trava vira uma discussão sobre quem está certo.
    const projetoDoDocumento = new Map((documentos.data || []).map((d) => [d.id, d.projeto_id]));
    const bytesPorProjeto = new Map();
    for (const r of revisoes.data || []) {
      const p = projetoDoDocumento.get(r.documento_id);
      if (p) bytesPorProjeto.set(p, (bytesPorProjeto.get(p) || 0) + (Number(r.tamanho) || 0));
    }

    const bytesPorDono = new Map();
    const projetosPorDono = new Map();
    for (const p of projetos.data || []) {
      if (p.arquivado) continue;
      projetosPorDono.set(p.dono_id, (projetosPorDono.get(p.dono_id) || 0) + 1);
      bytesPorDono.set(p.dono_id, (bytesPorDono.get(p.dono_id) || 0) + (bytesPorProjeto.get(p.id) || 0));
    }

    const quadrosPorDono = new Map();
    for (const q of quadros.data || []) {
      if (q.arquivado) continue;
      quadrosPorDono.set(q.dono_id, (quadrosPorDono.get(q.dono_id) || 0) + 1);
    }

    let diario = supabase.from("abacato_eventos")
      .select("id, usuario_id, tipo, alvo, alvo_id, detalhe, criado_em")
      .gte("criado_em", desde).order("criado_em", { ascending: false }).limit(300);
    if (pessoa) diario = diario.eq("usuario_id", pessoa);
    const { data: eventos } = await diario;

    // O gráfico de atividade por dia. Contado aqui, e não no navegador, porque a resposta já
    // tem os eventos e somar de novo lá seria fazer o mesmo trabalho duas vezes.
    const porDia = new Map();
    const porTipo = new Map();
    for (const e of eventos || []) {
      const dia = String(e.criado_em).slice(0, 10);
      porDia.set(dia, (porDia.get(dia) || 0) + 1);
      porTipo.set(e.tipo, (porTipo.get(e.tipo) || 0) + 1);
    }

    return json({
      ok: true,
      resumo: {
        contas: pessoas.length,
        clientes: pessoas.filter((p) => p.tipo === "cliente").length,
        aguardando: pessoas.filter((p) => p.aprovado === false).length,
        quadros: (quadros.data || []).filter((q) => !q.arquivado).length,
        projetos: (projetos.data || []).filter((p) => !p.arquivado).length,
        documentos: (documentos.data || []).length,
        bytes: [...bytesPorProjeto.values()].reduce((a, b) => a + b, 0),
        tamanho: emTamanho([...bytesPorProjeto.values()].reduce((a, b) => a + b, 0)),
      },

      pessoas: pessoas.map((p) => {
        const plano = planoDe(p.tipo);
        return {
          ...p,
          plano: plano.rotulo,
          quadros: medir(quadrosPorDono.get(p.id) || 0, plano.quadros),
          projetos: medir(projetosPorDono.get(p.id) || 0, plano.projetos),
          armazenamento: medir(bytesPorDono.get(p.id) || 0, plano.armazenamento),
          tamanho: emTamanho(bytesPorDono.get(p.id) || 0),
        };
      }),

      quadros: (quadros.data || []).map((q) => ({
        id: q.id, nome: q.nome, arquivado: q.arquivado, criado_em: q.criado_em,
        dono: nomePorId.get(q.dono_id)?.nome || "—",
        donoEmail: nomePorId.get(q.dono_id)?.email || null,
        donoTipo: nomePorId.get(q.dono_id)?.tipo || null,
        cards: cardsPorQuadro.get(q.id) || 0,
      })),

      projetos: (projetos.data || []).map((p) => ({
        id: p.id, nome: p.nome, arquivado: p.arquivado, criado_em: p.criado_em,
        dono: nomePorId.get(p.dono_id)?.nome || "—",
        donoTipo: nomePorId.get(p.dono_id)?.tipo || null,
        tamanho: emTamanho(bytesPorProjeto.get(p.id) || 0),
      })),

      eventos: (eventos || []).map((e) => ({
        ...e,
        quem: nomePorId.get(e.usuario_id)?.nome || "—",
        quemEmail: nomePorId.get(e.usuario_id)?.email || null,
      })),

      porDia: [...porDia.entries()].sort().map(([dia, quantos]) => ({ dia, quantos })),
      porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, quantos]) => ({ tipo, quantos })),
      dias,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
