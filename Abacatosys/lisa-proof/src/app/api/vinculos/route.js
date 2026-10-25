import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { vinculosDoAlvo, conferirAlvo } from "@/lib/vinculos.js";
import { leituraDoCard } from "@/lib/leituras.js";
import { normalizarAlvo } from "@/dominio/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vinculos?tipo=trilha|assunto|torre|livro&id= — as anotações ligadas a um ponto de estudo
 * (na trilha, também as dos assuntos; na torre, as dos andares). No assunto, vem junto a leitura do
 * livro, quando o assunto é de um curso feito a partir de um livro.
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const u = new URL(req.url).searchParams;
    const tipo = u.get("tipo");
    const id = u.get("id");
    const anotacoes = await vinculosDoAlvo(usuario.id, { tipo, id });
    let leitura = null;
    if (tipo === "assunto") {
      const n = normalizarAlvo({ tipo, id });
      if (n.ok) {
        await conferirAlvo(usuario.id, n.alvo); // o assunto é da pessoa
        leitura = await leituraDoCard(id);
      }
    }
    return json({ ok: true, anotacoes, leitura });
  } catch (e) {
    return respostaDeErro(e);
  }
}
