import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { proporCurso, proporCursoDoLivro } from "@/lib/iaCurso.js";
import { temModelo } from "@/lib/ia.js";
import { exigirLivro, trechosDoLivro } from "@/lib/biblioteca.js";
import { assuntosParaODuracao, resumoDoCurso, NIVEIS_DO_CURSO, DURACOES_EM_SEMANAS } from "@/dominio/curso.js";
import { normalizarDiasDeEstudo } from "@/dominio/plano.js";
import { juntarFaixas, secoesDoLivro } from "@/dominio/biblioteca.js";
import { cotasDoMaterial, materialDoCurso, assuntosParaOLivro } from "@/dominio/cursoDoLivro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cursos/proposta
 *   body: { tema, nivel, objetivo?, semanas, diasDeEstudo }
 *      ou { livroId, faixas: [{ de, ate }], nivel, objetivo?, semanas, diasDeEstudo }  (curso a partir de um livro)
 *
 * A Lisa propõe o curso. NÃO grava nada: a pessoa vê a proposta antes, e só a rota /api/cursos
 * cria o quadro. Pode levar de 20 a 90 segundos (é um curso inteiro; do livro, lendo o livro).
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
    const corpo = await corpoDe(req);

    const nivel = NIVEIS_DO_CURSO[corpo?.nivel] ? corpo.nivel : "iniciante";
    const semanas = DURACOES_EM_SEMANAS.includes(Number(corpo?.semanas)) ? Number(corpo.semanas) : 4;
    const dias = normalizarDiasDeEstudo(corpo?.diasDeEstudo);
    const objetivo = String(corpo?.objetivo || "").replace(/\s+/g, " ").trim().slice(0, 400);

    let r;
    if (corpo?.livroId) {
      r = await propostaDoLivro({ usuarioId: usuario.id, corpo, nivel, semanas, dias, objetivo });
    } else {
      const tema = String(corpo?.tema || "").replace(/\s+/g, " ").trim();
      if (tema.length < 2 || tema.length > 80) throw new ErroDeAcesso(400, "informe o tema do curso (até 80 caracteres)");
      try {
        r = await proporCurso({
          tema, nivel, objetivo, semanas,
          assuntos: assuntosParaODuracao(semanas, dias.length),
          dias: semanas * dias.length,
        });
      } catch (e) {
        throw new ErroDeAcesso(502, e.message);
      }
    }
    if (!r.ok) throw new ErroDeAcesso(502, r.erros.join("; "));
    return json({ ok: true, proposta: r.proposta, resumo: resumoDoCurso(r.proposta), ...(r.aviso ? { aviso: r.aviso } : {}) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * O curso a partir de um livro: as seções que caem nas páginas escolhidas, o começo do texto de
 * cada uma (cortado no banco, na medida do tamanho da seção) e o pedido à IA.
 */
async function propostaDoLivro({ usuarioId, corpo, nivel, semanas, dias, objetivo }) {
  const livro = await exigirLivro(usuarioId, corpo.livroId, "id, titulo, autor, paginas, sumario, status, paginas_com_texto");
  if (livro.status !== "pronto") throw new ErroDeAcesso(409, "o livro ainda está sendo lido — espere terminar e tente de novo");
  if (!livro.paginas_com_texto) {
    throw new ErroDeAcesso(422, "este PDF não tem texto (parece escaneado, só imagens): dá para ler e marcar, mas a Lisa não consegue montar o curso a partir dele");
  }
  const faixas = juntarFaixas(Array.isArray(corpo.faixas) && corpo.faixas.length ? corpo.faixas : [{ de: 1, ate: livro.paginas }], livro.paginas);
  // as seções do livro que caem nas faixas, recortadas nelas
  const secoes = [];
  for (const s of secoesDoLivro(livro.sumario, livro.paginas)) {
    for (const f of faixas) {
      const de = Math.max(s.de, f.de);
      const ate = Math.min(s.ate, f.ate);
      if (de <= ate) secoes.push({ ...s, de, ate });
    }
  }
  // seção que contém outra (capítulo e as seções dele): fica a mais funda, para não ler o mesmo texto duas vezes
  const folhas = secoes.filter((s) => !secoes.some((o) => o !== s && o.nivel > s.nivel && o.de >= s.de && o.ate <= s.ate));
  const usadas = (folhas.length ? folhas : secoes).slice(0, 220);
  const cotas = cotasDoMaterial(usadas);
  // uma ida ao banco por cota diferente (seções do mesmo tamanho dividem a mesma ida)
  const porCota = new Map();
  for (const s of cotas) porCota.set(s.cota, [...(porCota.get(s.cota) || []), { de: s.de, ate: s.ate }]);
  const trechos = (await Promise.all([...porCota.entries()].map(([cota, fx]) => trechosDoLivro(livro.id, fx, cota)))).flat();
  const emOrdem = (lista) => [...lista].sort((a, b) => a.de - b.de || a.nivel - b.nivel);
  const material = materialDoCurso({ livro, secoes: emOrdem(usadas), sumario: emOrdem(secoes), trechos });

  const paginasEscolhidas = faixas.reduce((s, f) => s + f.ate - f.de + 1, 0);
  let r;
  try {
    r = await proporCursoDoLivro({
      livro, material: material.texto, faixas, nivel, objetivo, semanas,
      assuntos: assuntosParaOLivro(assuntosParaODuracao(semanas, dias.length), paginasEscolhidas),
      dias: semanas * dias.length,
    });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }
  if (material.semTexto) r.aviso = `${material.semTexto} seção(ões) sem texto no PDF (imagens): a Lisa montou essa parte só pelo sumário.`;
  return r;
}
