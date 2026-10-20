// O chamado até o Abacato: acha (ou monta) o quadro de chamados do administrador, cria o card,
// anexa o print num comentário e marca a etiqueta "Bug". Mesmo banco, pela chave de serviço.
//
// O administrador é a conta do Abacato com o e-mail PROOF_ADMIN_EMAIL (o mesmo e-mail de acesso
// da Lisa). O quadro é DELE e só dele: quem reporta não entra como membro, então ninguém lê o
// chamado de outra pessoa.
//
// O print vai para o bucket privado dos comentários do Abacato, no mesmo caminho que um print
// colado num comentário teria — por isso ele aparece no card do jeito de sempre.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import {
  NOME_DO_QUADRO_DE_CHAMADOS, COLUNAS_DE_CHAMADOS, ORIGEM_DO_CHAMADO, LIMITE_POR_DIA,
  TIPOS_DE_IMAGEM, tituloDoChamado, descricaoDoChamado,
} from "@/dominio/chamado.js";

const BUCKET_DE_COMENTARIOS = "abacato-comentarios"; // o do Abacato (src/lib/comentariosNoBanco.js)
const PASSO = 1024; // o espaçamento de posição do Abacato

async function administrador() {
  const email = String(process.env.PROOF_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) throw new ErroDeAcesso(500, "o Proof não sabe para quem mandar o chamado (falta PROOF_ADMIN_EMAIL)");
  const { data, error } = await supabase.from("abacato_usuarios").select("id, nome").ilike("email", email).maybeSingle();
  if (error) throw new ErroDeAcesso(500, error.message);
  if (!data) throw new ErroDeAcesso(500, "a conta do administrador não existe no Abacato");
  return data;
}

/** O quadro de chamados do administrador, criado na primeira vez, com colunas e etiqueta. */
async function quadroDeChamados(adminId) {
  const { data: existente } = await supabase
    .from("abacato_quadros").select("id")
    .eq("dono_id", adminId).eq("nome", NOME_DO_QUADRO_DE_CHAMADOS).eq("arquivado", false)
    .order("criado_em").limit(1).maybeSingle();
  let quadroId = existente?.id;

  if (!quadroId) {
    const { data: novo, error } = await supabase.from("abacato_quadros").insert({
      nome: NOME_DO_QUADRO_DE_CHAMADOS,
      dono_id: adminId,
      descricao: "Problemas reportados pelo botão \"Reportar problema\" do Lisa_Proof. Cada card traz quem reportou, a tela, o aparelho e o print.",
    }).select("id").single();
    if (error) throw new ErroDeAcesso(500, `não consegui criar o quadro de chamados: ${error.message}`);
    quadroId = novo.id;
    await supabase.from("abacato_colunas").insert(
      COLUNAS_DE_CHAMADOS.map((nome, i) => ({ quadro_id: quadroId, nome, posicao: (i + 1) * PASSO })),
    );
    await supabase.from("abacato_etiquetas").insert({ quadro_id: quadroId, nome: "Bug", cor: "#EF4444" });
  }

  // A primeira coluna ativa recebe o chamado (se alguém renomeou "Novos", tudo bem).
  const { data: colunas } = await supabase
    .from("abacato_colunas").select("id").eq("quadro_id", quadroId).eq("arquivada", false).order("posicao").limit(1);
  let colunaId = colunas?.[0]?.id;
  if (!colunaId) {
    const { data: nova } = await supabase.from("abacato_colunas")
      .insert({ quadro_id: quadroId, nome: COLUNAS_DE_CHAMADOS[0], posicao: PASSO }).select("id").single();
    colunaId = nova.id;
  }
  const { data: etiqueta } = await supabase
    .from("abacato_etiquetas").select("id").eq("quadro_id", quadroId).eq("nome", "Bug").limit(1).maybeSingle();
  return { quadroId, colunaId, etiquetaId: etiqueta?.id || null };
}

/** Quantos chamados esta pessoa já abriu hoje (a trava contra um botão apertado sem parar). */
async function chamadosDeHoje(usuarioId) {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("abacato_cards").select("id", { count: "exact", head: true })
    .eq("origem", ORIGEM_DO_CHAMADO).like("origem_id", `${usuarioId}/%`).gte("criado_em", desde);
  return count || 0;
}

/**
 * Abre o chamado. `conferido` já passou por conferirChamado; `imagem` é o File do print (ou nada).
 * Devolve { cardId }.
 */
export async function abrirChamado({ usuario, conferido, imagem, versao }) {
  if ((await chamadosDeHoje(usuario.id)) >= LIMITE_POR_DIA) {
    throw new ErroDeAcesso(429, `você já mandou ${LIMITE_POR_DIA} chamados nas últimas 24 horas — obrigado! Se for urgente, fale direto com o administrador.`);
  }
  const admin = await administrador();
  const { quadroId, colunaId, etiquetaId } = await quadroDeChamados(admin.id);

  // no TOPO da coluna: o chamado mais novo aparece primeiro
  const { data: primeiro } = await supabase
    .from("abacato_cards").select("posicao").eq("coluna_id", colunaId).eq("arquivado", false)
    .order("posicao").limit(1).maybeSingle();

  const instante = new Date();
  const { data: card, error } = await supabase.from("abacato_cards").insert({
    coluna_id: colunaId,
    titulo: tituloDoChamado(conferido.texto),
    descricao: descricaoDoChamado({ ...conferido, usuario, instante, versao }),
    posicao: (primeiro?.posicao ?? PASSO) - PASSO,
    origem: ORIGEM_DO_CHAMADO,
    origem_id: `${usuario.id}/${instante.getTime()}`,
  }).select("id").single();
  if (error) throw new ErroDeAcesso(500, `não consegui abrir o chamado: ${error.message}`);

  if (etiquetaId) await supabase.from("abacato_card_etiquetas").insert({ card_id: card.id, etiqueta_id: etiquetaId });

  if (imagem) {
    const tipo = imagem.type;
    const caminho = `${quadroId}/${card.id}/${crypto.randomUUID()}.${TIPOS_DE_IMAGEM[tipo]}`;
    const { error: erroDoEnvio } = await supabase.storage
      .from(BUCKET_DE_COMENTARIOS).upload(caminho, await imagem.arrayBuffer(), { contentType: tipo, upsert: false });
    if (!erroDoEnvio) {
      const { data: comentario } = await supabase.from("abacato_comentarios")
        .insert({ card_id: card.id, autor_id: usuario.id, texto: "Print da tela no momento do problema." }).select("id").single();
      if (comentario) {
        await supabase.from("abacato_comentario_anexos").insert({
          comentario_id: comentario.id, quadro_id: quadroId, caminho,
          nome: `print-${instante.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${TIPOS_DE_IMAGEM[tipo]}`,
          tipo, tamanho: imagem.size, posicao: 0,
        });
      }
    }
    // O print falhar não derruba o chamado: o relato é o que mais importa, e ele já está gravado.
  }

  await supabase.from("abacato_quadros").update({ atualizado_em: instante.toISOString() }).eq("id", quadroId);
  return { cardId: card.id };
}
