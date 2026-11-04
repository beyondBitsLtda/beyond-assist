// Modo Rádio: playlist mantida manualmente pelo usuário em radio/playlist.txt — uma música por
// linha, formato "Título:URL" (URL do YouTube). Arquivo do repositório, não do Supabase — o
// usuário edita direto, sem precisar de nenhuma tela de upload.
//
// O conteúdo entra no bundle em tempo de build (regra `asset/source` no next.config.mjs). Era
// lido do disco com fs/promises, o que não existe no Edge runtime do Cloudflare — e ali a
// playlist apareceria simplesmente vazia. Editar o arquivo continua bastando: ele é lido no
// próximo deploy.
import raw from "../../radio/playlist.txt";

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

/** Lê e parseia radio/playlist.txt — linhas sem ":http" (em branco, comentário, mal formatada)
 * são ignoradas em silêncio, nunca derrubam a playlist inteira por causa de uma linha ruim. */
export async function getRadioPlaylist() {
  // continua async: mudar a assinatura obrigaria a mexer em quem chama, sem ganho nenhum
  return String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":http");
      if (idx === -1) return null;
      const title = line.slice(0, idx).trim();
      const url = line.slice(idx + 1).trim();
      const videoId = extractYouTubeId(url);
      return videoId && title ? { title, url, videoId } : null;
    })
    .filter(Boolean);
}
