import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, carregarQuadro, quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { materializarRecorrencias } from "@/lib/recorrenciaNoBanco.js";
import { paredeValida } from "@/dominio/paredes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quadros/:id — o quadro inteiro, numa resposta só.
 *
 * Inteiro mesmo: colunas, cards, etiquetas, responsáveis, checklists e links. A alternativa —
 * carregar cards ao abrir cada coluna — economiza bytes na primeira tela e paga com um
 * pisca-pisca a cada rolagem lateral. Um quadro de trabalho tem dezenas de cards, não milhares.
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    // Antes de ler: as tarefas recorrentes que venceram viram cards. Fica aqui, e não num cron,
    // porque quem não abre o quadro não precisa dos cards — e assim o recurso funciona igual
    // aqui, no iMac e na nuvem, sem depender de um agendador existir nos três lugares.
    const criadas = await materializarRecorrencias(id);

    const { quadro, papel, poderes, cru } = await carregarQuadro(id, usuario.id);
    return json({
      ok: true,
      quadro: cru,
      papel,
      poderes,
      eu: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      resumo: quadro.resumo(),
      recorrenciasCriadas: criadas,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PATCH /api/quadros/:id — nome, descrição, papel de parede, arquivar. */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();
    if ("descricao" in corpo) mudancas.descricao = corpo.descricao || null;
    if ("papelDeParede" in corpo) {
      // Conferir, e não aceitar qualquer texto: o valor vai direto para o `style` da tela, e
      // `url("https://servidor-de-alguem/x.png")` é CSS válido que o navegador BUSCA ao abrir
      // o quadro — um aviso silencioso, para fora, toda vez que alguém olha o quadro.
      if (!paredeValida(corpo.papelDeParede || null, process.env.SUPABASE_URL)) {
        throw new ErroDeAcesso(400, "papel de parede inválido: use um dos prontos ou envie uma imagem");
      }
      mudancas.papel_de_parede = corpo.papelDeParede || null;
    }
    if (typeof corpo.arquivado === "boolean") mudancas.arquivado = corpo.arquivado;
    if (!Object.keys(mudancas).length) return json({ ok: false, error: "nada para mudar" }, 400);

    mudancas.atualizado_em = new Date().toISOString();
    const { data, error } = await supabase.from("abacato_quadros").update(mudancas).eq("id", id)
      .select("id, nome, descricao, papel_de_parede, arquivado").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, quadro: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/quadros/:id — arquiva, e só o dono.
 *
 * Arquiva, não apaga: o `on delete cascade` do esquema levaria junto colunas, cards,
 * checklists e o histórico inteiro, sem volta e sem aviso. Apagar de verdade fica para uma
 * tela de lixeira, onde a pessoa vê o que vai perder antes de perder.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { papel } = await exigir(req, "quadro", id, "apagar");
    if (papel !== "dono") throw new ErroDeAcesso(403, "só o dono arquiva o quadro");
    const { error } = await supabase.from("abacato_quadros").update({ arquivado: true }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
