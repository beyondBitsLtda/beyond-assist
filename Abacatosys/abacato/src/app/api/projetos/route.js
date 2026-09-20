import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { corValida } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projetos — os projetos de documentação que esta pessoa pode abrir. */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
    const querArquivados = new URL(req.url).searchParams.get("arquivados") === "1";

    const [meus, convidados] = await Promise.all([
      supabase.from("abacato_projetos")
        .select("id, nome, descricao, cor, dono_id, criado_em")
        .eq("dono_id", usuario.id).eq("arquivado", querArquivados),
      supabase.from("abacato_projeto_membros")
        .select("papel, abacato_projetos ( id, nome, descricao, cor, dono_id, criado_em, arquivado )")
        .eq("usuario_id", usuario.id),
    ]);
    if (meus.error) throw new ErroDeAcesso(500, meus.error.message);

    const lista = [...(meus.data || []).map((p) => ({ ...p, papel: "dono" }))];
    for (const linha of convidados.data || []) {
      const p = linha.abacato_projetos;
      if (!p || Boolean(p.arquivado) !== querArquivados || lista.some((x) => x.id === p.id)) continue;
      lista.push({ ...p, papel: linha.papel });
    }

    // Quantos documentos cada um tem. Um projeto de documentação sem essa conta obriga a
    // entrar para descobrir se há algo lá dentro.
    const contagem = new Map();
    if (lista.length) {
      const { data } = await supabase.from("abacato_documentos")
        .select("projeto_id").in("projeto_id", lista.map((p) => p.id)).eq("arquivado", false);
      for (const d of data || []) contagem.set(d.projeto_id, (contagem.get(d.projeto_id) || 0) + 1);
    }

    let arquivados = 0;
    if (!querArquivados) {
      const { count } = await supabase.from("abacato_projetos")
        .select("id", { count: "exact", head: true }).eq("dono_id", usuario.id).eq("arquivado", true);
      arquivados = count || 0;
    }

    lista.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    return json({
      ok: true,
      projetos: lista.map((p) => ({ ...p, documentos: contagem.get(p.id) || 0 })),
      arquivados,
      mostrandoArquivados: querArquivados,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/projetos   body: { nome, descricao?, cor? } */
export async function POST(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
    const { nome, descricao, cor } = await req.json().catch(() => ({}));
    if (!nome?.trim()) throw new ErroDeAcesso(400, "o projeto precisa de um nome");

    const { data, error } = await supabase.from("abacato_projetos").insert({
      nome: nome.trim(),
      descricao: descricao?.trim() || null,
      cor: corValida(cor) ? cor : "#22C55E",
      dono_id: usuario.id,
    }).select("id, nome, descricao, cor, criado_em").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, projeto: { ...data, papel: "dono", documentos: 0 } }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
