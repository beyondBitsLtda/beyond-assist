import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { perfilDe, buscarTodas } from "@/lib/estudo.js";
import { diaDe, somarDias, inicioDaSemana } from "@/dominio/datas.js";
import { calcularOfensiva } from "@/dominio/ofensiva.js";
import { nivelPorPontos, NOMES_DOS_EVENTOS } from "@/dominio/pontos.js";
import { estatisticas, vitrine } from "@/dominio/conquistas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantas semanas o mapa de calor mostra. */
const SEMANAS = 16;

/** GET /api/progresso — histórico: mapa de dias estudados, totais e últimos eventos. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const hoje = diaDe();
    const [perfil, eventos] = await Promise.all([
      perfilDe(usuario.id),
      buscarTodas(() =>
        supabase.from("proof_eventos").select("tipo, chave, pontos, dia, detalhe, criado_em").eq("usuario_id", usuario.id).order("criado_em")
      ),
    ]);

    const porDia = new Map();
    for (const e of eventos) porDia.set(e.dia, (porDia.get(e.dia) || 0) + e.pontos);

    const comeco = somarDias(inicioDaSemana(hoje), -7 * (SEMANAS - 1));
    const mapa = [];
    for (let d = comeco; d <= somarDias(inicioDaSemana(hoje), 6); d = somarDias(d, 1)) {
      mapa.push({ dia: d, pontos: porDia.get(d) || 0, futuro: d > hoje });
    }

    const total = eventos.reduce((s, e) => s + e.pontos, 0);
    const contagem = {};
    for (const e of eventos) contagem[e.tipo] = (contagem[e.tipo] || 0) + 1;

    return json({
      ok: true,
      hoje,
      metaDiaria: perfil.metaDiaria,
      total,
      nivel: nivelPorPontos(total),
      ofensiva: calcularOfensiva(porDia.keys(), hoje),
      diasEstudados: porDia.size,
      contagem,
      conquistas: vitrine(estatisticas(eventos, hoje), eventos),
      pontosDeConquistas: eventos.filter((e) => e.tipo === "conquista").reduce((s, e) => s + e.pontos, 0),
      mapa,
      recentes: eventos.slice(-25).reverse().map((e) => ({
        tipo: e.tipo,
        nome: NOMES_DOS_EVENTOS[e.tipo] || e.tipo,
        texto: e.detalhe?.texto || e.detalhe?.titulo || e.detalhe?.nome || "",
        assunto: e.detalhe?.texto ? e.detalhe?.titulo || "" : "",
        pontos: e.pontos,
        dia: e.dia,
      })),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
