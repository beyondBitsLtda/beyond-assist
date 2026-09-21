import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { COOKIE_SESSAO, lerSessao } from "@/lib/abacatoAuth.js";
import { respostaDeErro } from "@/lib/acesso.js";
import { exigirPodeCriarQuadro } from "@/lib/limites.js";
import { anotar, anotarLimite, TIPOS_DE_EVENTO } from "@/lib/eventos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quem está pedindo. O middleware já barrou quem não tem sessão; aqui precisamos do ID. */
async function quemEh(req) {
  const cookie = req.headers.get("cookie") || "";
  const valor = cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(COOKIE_SESSAO + "="))?.slice(COOKIE_SESSAO.length + 1);
  const sessao = await lerSessao(valor, process.env.ABACATO_SESSAO_SECRET);
  return sessao.ok ? sessao.usuario : null;
}

/**
 * GET /api/quadros — os quadros que esta pessoa pode abrir.
 *
 * Os que ela criou MAIS aqueles em que foi posta como membro. As duas consultas são separadas
 * porque o Postgres não tem um "ou" barato entre uma coluna e uma tabela de junção, e juntar na
 * mão aqui é mais claro que uma view que ninguém vai lembrar de manter.
 */
export async function GET(req) {
  const usuario = await quemEh(req);
  if (!usuario) return json({ ok: false, error: "sem sessão" }, 401);

  // `?arquivados=1` lista o que saiu de vista. Sem esta lista, arquivar seria um caminho sem
  // volta pela tela: o quadro continuaria no banco, inteiro, e invisível para sempre.
  const querArquivados = new URL(req.url).searchParams.get("arquivados") === "1";

  const [meus, convidados] = await Promise.all([
    supabase.from("abacato_quadros")
      .select("id, nome, descricao, papel_de_parede, dono_id, criado_em")
      .eq("dono_id", usuario.id).eq("arquivado", querArquivados),
    supabase.from("abacato_membros")
      .select("papel, abacato_quadros ( id, nome, descricao, papel_de_parede, dono_id, criado_em, arquivado )")
      .eq("usuario_id", usuario.id),
  ]);

  if (meus.error) return json({ ok: false, error: meus.error.message }, 500);

  const lista = [...(meus.data || []).map((q) => ({ ...q, papel: "dono" }))];
  for (const linha of convidados.data || []) {
    const q = linha.abacato_quadros;
    // O membro pode ter sido posto num quadro que depois foi arquivado; e o dono já entrou
    // pela primeira consulta — sem esta checagem ele apareceria duas vezes.
    if (!q || Boolean(q.arquivado) !== querArquivados || lista.some((x) => x.id === q.id)) continue;
    lista.push({ ...q, papel: linha.papel });
  }

  lista.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

  // Quantos estão arquivados, sempre. É o que permite a tela oferecer "ver arquivados" só
  // quando existe algum — um link que leva a uma lista vazia é ruído permanente.
  let arquivados = 0;
  if (!querArquivados) {
    const { count } = await supabase.from("abacato_quadros")
      .select("id", { count: "exact", head: true })
      .eq("dono_id", usuario.id).eq("arquivado", true);
    arquivados = count || 0;
  }

  return json({ ok: true, quadros: lista, arquivados, mostrandoArquivados: querArquivados });
}

/** POST /api/quadros   body: { nome, descricao } — cria um quadro com as três colunas de
 *  sempre. Quadro nascendo vazio obriga a inventar as colunas antes de poder usar. */
export async function POST(req) {
  const usuario = await quemEh(req);
  if (!usuario) return json({ ok: false, error: "sem sessão" }, 401);

  const { nome, descricao } = await req.json().catch(() => ({}));
  if (!nome || !String(nome).trim()) return json({ ok: false, error: "o quadro precisa de um nome" }, 400);

  // O limite do plano é conferido AQUI, e não na tela. A tela esconde o botão quando o teto
  // estourou; isso é conforto. Quem abre o inspetor e chama esta rota na mão encontra a
  // mesma resposta.
  try {
    await exigirPodeCriarQuadro(usuario.id);
  } catch (e) {
    anotarLimite({ usuarioId: usuario.id, limite: "quadros" });
    return respostaDeErro(e);
  }

  const { data: quadro, error } = await supabase
    .from("abacato_quadros")
    .insert({ nome: String(nome).trim(), descricao: descricao || null, dono_id: usuario.id })
    .select("id, nome, descricao, dono_id, criado_em")
    .single();
  if (error) return json({ ok: false, error: error.message }, 500);

  const colunas = ["A fazer", "Fazendo", "Feito"].map((nome, i) => ({
    quadro_id: quadro.id, nome, posicao: (i + 1) * 1024,
  }));
  await supabase.from("abacato_colunas").insert(colunas);

  anotar({ usuarioId: usuario.id, tipo: TIPOS_DE_EVENTO.criouQuadro, alvo: quadro.nome, alvoId: quadro.id });
  return json({ ok: true, quadro: { ...quadro, papel: "dono" } }, 201);
}
