import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Uma pasta arrastada pode ter muita coisa dentro. O teto existe para um engano — arrastar a
// pasta de Downloads inteira — não virar mil pastas no projeto antes de alguém perceber.
const TETO_DE_PASTAS = 300;
const FUNDO_MAXIMO = 12;

/**
 * POST /api/projetos/:id/arvore   body: { caminhos: [["Obra","Contratos","2026"], ...], paiId? }
 *
 * Garante que essas pastas existam, e devolve o id de cada uma. É o que faz arrastar uma pasta
 * do computador recriar a estrutura dela aqui dentro, em vez de despejar sessenta arquivos
 * soltos na raiz.
 *
 * GARANTE, e não cria: uma pasta que já existe com aquele nome, naquele lugar, é REAPROVEITADA.
 * Sem isso, arrastar a mesma pasta duas vezes — ou a versão atualizada dela na semana seguinte
 * — deixaria duas "Contratos" lado a lado, e os documentos divididos entre as duas sem nenhum
 * critério que alguém consiga explicar depois.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "projeto", id, "criar");

    const { caminhos, paiId } = await req.json().catch(() => ({}));
    if (!Array.isArray(caminhos)) throw new ErroDeAcesso(400, "faltaram os caminhos");

    if (paiId) {
      const { data: pai } = await supabase
        .from("abacato_pastas").select("id, projeto_id").eq("id", paiId).maybeSingle();
      if (!pai) throw new ErroDeAcesso(404, "pasta de destino não existe");
      if (pai.projeto_id !== id) throw new ErroDeAcesso(403, "essa pasta é de outro projeto");
    }

    // Limpa e desdobra: ["Obra","Contratos"] precisa que "Obra" exista antes. Um Set de
    // caminhos PARCIAIS resolve os dois problemas de uma vez — a ordem e a repetição.
    const necessarios = new Set();
    for (const bruto of caminhos) {
      const partes = (Array.isArray(bruto) ? bruto : String(bruto || "").split("/"))
        .map((p) => String(p || "").trim())
        // `.` e `..` viriam de um caminho montado à mão para escapar da árvore; nomes vazios
        // vêm de uma barra dupla, que é comum e inofensiva.
        .filter((p) => p && p !== "." && p !== "..")
        .slice(0, FUNDO_MAXIMO);
      for (let i = 1; i <= partes.length; i++) necessarios.add(JSON.stringify(partes.slice(0, i)));
    }

    if (necessarios.size > TETO_DE_PASTAS) {
      throw new ErroDeAcesso(400,
        `isso criaria ${necessarios.size} pastas — o limite é ${TETO_DE_PASTAS}. Arraste uma pasta menor.`);
    }

    const { data: existentes } = await supabase
      .from("abacato_pastas").select("id, pai_id, nome")
      .eq("projeto_id", id).eq("arquivada", false);

    // A chave é pai + nome em minúsculas: "Contratos" e "contratos" no mesmo lugar são a mesma
    // pasta para quem olha, e tratá-las como duas seria a duplicata que esta rota existe para
    // evitar.
    const chave = (pai, nome) => `${pai || "raiz"}::${nome.toLowerCase()}`;
    const porChave = new Map((existentes || []).map((p) => [chave(p.pai_id, p.nome), p.id]));

    // Do mais curto para o mais fundo, para o pai de cada uma já existir quando ela for criada.
    const ordenados = [...necessarios].map((c) => JSON.parse(c)).sort((a, b) => a.length - b.length);

    const ids = {};
    let criadas = 0;
    for (const partes of ordenados) {
      let atual = paiId || null;
      for (const nome of partes) {
        const k = chave(atual, nome);
        let achada = porChave.get(k);
        if (!achada) {
          const { data, error } = await supabase.from("abacato_pastas").insert({
            projeto_id: id, pai_id: atual, nome, posicao: 1024 + criadas,
          }).select("id").single();
          if (error) throw new ErroDeAcesso(500, error.message);
          achada = data.id;
          porChave.set(k, achada);
          criadas++;
        }
        atual = achada;
      }
      ids[partes.join("/")] = atual;
    }

    return json({ ok: true, pastas: ids, criadas });
  } catch (e) {
    return respostaDeErro(e);
  }
}
