import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { paredeDeImagem, urlDaParede } from "@/dominio/paredes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const TETO = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/quadros/:id/parede — envia uma imagem de fundo (multipart, campo `arquivo`).
 *
 * O arquivo PASSA pelo servidor, em vez de ir direto do navegador para o armazenamento com uma
 * URL assinada. A URL assinada seria mais eficiente e traz uma complicação que não vale a pena
 * aqui: ela exige que o navegador alcance `banco.beyond.dev.br` por conta própria, o que
 * depende de CORS configurado num serviço que não é nosso. Dez megabytes atravessando o Worker
 * é um custo pequeno e previsível.
 *
 * O teto de 10 MB não é só de espaço: o papel de parede é baixado a cada abertura do quadro, e
 * uma foto de 20 MB faria o quadro demorar para aparecer no celular em 4G.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "editar");

    const form = await req.formData().catch(() => null);
    const arquivo = form?.get("arquivo");
    if (!arquivo || typeof arquivo === "string") throw new ErroDeAcesso(400, "faltou o arquivo");

    if (!TIPOS.includes(arquivo.type)) {
      throw new ErroDeAcesso(400, `tipo não aceito (${arquivo.type || "desconhecido"}) — use JPG, PNG, WEBP ou AVIF`);
    }
    if (arquivo.size > TETO) {
      throw new ErroDeAcesso(400, `a imagem tem ${(arquivo.size / 1048576).toFixed(1)} MB — o limite é 10 MB`);
    }

    const extensao = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[arquivo.type];
    // O nome é sorteado, e é ele que protege a imagem: o bucket é público, então quem não tem
    // o endereço exato não chega nela. Usar o nome original entregaria "contrato-cliente.png"
    // a qualquer um que chutasse.
    const caminho = `${id}/${crypto.randomUUID()}.${extensao}`;

    const { error: erroUp } = await supabase.storage
      .from("abacato-paredes")
      .upload(caminho, await arquivo.arrayBuffer(), { contentType: arquivo.type, upsert: false });
    if (erroUp) throw new ErroDeAcesso(500, `não consegui guardar a imagem: ${erroUp.message}`);

    const { data: publico } = supabase.storage.from("abacato-paredes").getPublicUrl(caminho);
    const parede = paredeDeImagem(publico.publicUrl);

    // A imagem ANTIGA é apagada depois que a nova entra, e não antes. Se a gravação falhasse
    // no meio, apagar primeiro deixaria o quadro sem fundo nenhum e sem volta.
    const { data: antes } = await supabase
      .from("abacato_quadros").select("papel_de_parede").eq("id", id).maybeSingle();

    const { error } = await supabase.from("abacato_quadros")
      .update({ papel_de_parede: parede, atualizado_em: new Date().toISOString() }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);

    const urlAntiga = urlDaParede(antes?.papel_de_parede);
    if (urlAntiga) {
      const pedaco = urlAntiga.split("/abacato-paredes/")[1];
      // Falhar aqui não pode derrubar o envio: o quadro já está com o fundo novo, e o que
      // sobra é um arquivo órfão ocupando alguns megabytes.
      if (pedaco) await supabase.storage.from("abacato-paredes").remove([pedaco]).catch(() => {});
    }

    return json({ ok: true, papelDeParede: parede }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
