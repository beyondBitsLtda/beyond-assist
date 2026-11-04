import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { bootcampDe, criarTorneio } from "@/lib/bootcamp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bootcamp — os torneios da pessoa e as opções da tela de criação (formatos, tempos, linguagens, personagens, jurados, jogadores). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await bootcampDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/bootcamp — cria um torneio.
 *   { nome, formato: "mata-mata"|"pontos-corridos", usarTempo, tempoMin, rodadas, total,
 *     linguagens: { modo: "livre"|"jurados", permitidas: [] }, npcs: [ids], convidados: [usuarioIds] }
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await criarTorneio(usuario.id, corpo)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
