// A BIBLIOTECA COLABORATIVA (pedido de 26/10/2026): "algo como o modo reino, porém uma biblioteca
// colaborativa, onde as pessoas podem anexar livros PDF (com nome, capa, categoria, assunto),
// artigos científicos, links de videoaulas, vídeos teóricos etc. Cada material passa por uma
// verificação (o bibliotecário é sempre o líder do ranking da semana e o meu usuário). Após a
// aprovação, quem pôs o material ganha moedas, em quantidade que depende do tipo. A construção da
// biblioteca vai melhorando conforme os materiais são postos, e a recompensa também aumenta. Os
// avatares dos jogadores interagem; cada tipo de arquivo tem construções e personagens próprios."
//
// Puro, como o resto de src/dominio: as regras do acervo (tipos, níveis, recompensas, o que vale
// como envio, o que é duplicado e quem pode revisar). O banco mora em src/lib/acervo.js; o mundo
// 3D em src/componentes/acervo/.
//
// DIREITOS AUTORAIS: a pessoa responsável decidiu aceitar qualquer PDF (26/10/2026), depois do
// alerta sobre livros com direitos. O bibliotecário pode RETIRAR um material do acervo a qualquer
// momento (status "retirado") — é o caminho para atender a uma reclamação.

export const TIPOS_DE_MATERIAL = {
  livro: { nome: "Livro", plural: "Livros", icone: "📕", recompensa: 300, formato: "pdf" },
  artigo: { nome: "Artigo científico", plural: "Artigos científicos", icone: "🔬", recompensa: 250, formato: "pdf-ou-link" },
  videoaula: { nome: "Videoaula", plural: "Videoaulas", icone: "🎓", recompensa: 150, formato: "video" },
  video: { nome: "Vídeo teórico", plural: "Vídeos teóricos", icone: "🎬", recompensa: 120, formato: "video" },
};
export const ORDEM_DOS_TIPOS = ["livro", "artigo", "videoaula", "video"];

/**
 * Cada tipo tem a sua construção na ilha e quem trabalha nela (a gestão daquele acervo). As falas
 * aparecem quando alguém clica no personagem.
 */
export const CONSTRUCOES_DO_ACERVO = {
  livro: {
    nome: "Torre dos Livros",
    personagem: {
      id: "celeste", nome: "Dona Celeste", cargo: "a Bibliotecária",
      falas: ["Cada livro tem o seu lugar na estante — e eu sei o de todos.", "Catalogo pela lombada, pelo assunto e pelo cheirinho de papel.", "Livro novo chegou? Deixa que eu encapo!", "Silêncio na torre, por favor… a não ser que seja para elogiar um livro."],
    },
  },
  artigo: {
    nome: "Observatório dos Artigos",
    personagem: {
      id: "iris", nome: "Doutora Íris", cargo: "a Cientista",
      falas: ["Revisão por pares é comigo: leio o método antes do resumo.", "Todo artigo bom tem referência — e eu confiro todas.", "Uma hipótese por dia mantém a ignorância longe.", "Do telescópio eu vejo as ideias chegando."],
    },
  },
  videoaula: {
    nome: "Auditório das Videoaulas",
    personagem: {
      id: "tobias", nome: "Mestre Tobias", cargo: "o Professor",
      falas: ["Devagar e sempre: uma aula por dia, sem pular a matéria.", "Organizo as aulas da mais fácil para a mais difícil.", "Cem anos de casco e ainda aprendo em toda aula.", "Quem ensina aprende duas vezes. Quem compartilha, três."],
    },
  },
  video: {
    nome: "Cinema dos Vídeos",
    personagem: {
      id: "pipoca", nome: "Pipoca", cargo: "o Projecionista",
      falas: ["Rolo novo na cabine! Pipoca e teoria, a melhor sessão.", "Separo os vídeos por tema, duração e quanta pipoca pedem.", "Documentário de física às oito; de história, às dez.", "Luz apagada, cérebro ligado!"],
    },
  },
};

export const CATEGORIAS_DO_ACERVO = [
  "Programação", "Dados e IA", "Matemática", "Física e Química", "Biologia e Saúde", "Engenharia",
  "Negócios e Finanças", "Idiomas", "Humanidades", "Artes e Design", "Outros",
];

/** Quantos materiais aprovados de um tipo levam a construção a cada nível (1 a 10). */
export const NIVEIS_DA_CONSTRUCAO = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45];
/** Quantos materiais aprovados, de todos os tipos, levam a biblioteca a cada nível (1 a 10). */
export const NIVEIS_DA_BIBLIOTECA = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];
/** Cada nível da biblioteca acima do 1º soma 10% à recompensa (no nível 10, 1,9×). */
export const BONUS_POR_NIVEL = 0.1;
/** O que o bibliotecário ganha por revisão (aprovar ou recusar), menos quando revisa o próprio envio. */
export const PAGAMENTO_DA_REVISAO = 25;
export const ENVIOS_POR_DIA = 5;
/** As gorjetas de agradecimento (uma por material por pessoa). */
export const GORJETAS = [10, 25, 50];

export const LIMITES_DO_ACERVO = {
  titulo: 160, autores: 160, assunto: 80, descricao: 600, motivo: 300, link: 500,
  arquivo: 50 * 1024 * 1024, paginas: 5000, capa: 160_000, itensDoSumario: 800,
};

const inteiro = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
/** Texto de uma linha: sem espaço sobrando, no limite. */
export const textoDoAcervo = (valor, limite) => String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);

/** Em que nível uma escada de limites está com `qtd`: { nivel, proximo, faltam } (proximo nulo no topo). */
function naEscada(escada, qtd) {
  const n = Math.max(0, inteiro(qtd));
  let nivel = 1;
  for (let i = 0; i < escada.length; i++) if (n >= escada[i]) nivel = i + 1;
  const proximo = nivel < escada.length ? escada[nivel] : null;
  return { nivel, proximo, faltam: proximo == null ? 0 : proximo - n };
}
export const nivelDaConstrucao = (qtd) => naEscada(NIVEIS_DA_CONSTRUCAO, qtd);
export const nivelDaBiblioteca = (total) => naEscada(NIVEIS_DA_BIBLIOTECA, total);

/** As moedas de um material aprovado, no nível de agora da biblioteca. */
export function recompensaDe(tipo, nivel) {
  const t = TIPOS_DE_MATERIAL[tipo];
  if (!t) return 0;
  const n = Math.min(NIVEIS_DA_BIBLIOTECA.length, Math.max(1, inteiro(nivel) || 1));
  return Math.round(t.recompensa * (1 + BONUS_POR_NIVEL * (n - 1)));
}

/** A biblioteca a partir de quantos materiais aprovados há de cada tipo. */
export function estadoDaBiblioteca(contagens = {}) {
  const construcoes = {};
  let total = 0;
  for (const tipo of ORDEM_DOS_TIPOS) {
    const qtd = Math.max(0, inteiro(contagens[tipo]));
    total += qtd;
    construcoes[tipo] = { qtd, ...nivelDaConstrucao(qtd) };
  }
  const b = nivelDaBiblioteca(total);
  return {
    total, ...b, construcoes,
    recompensas: Object.fromEntries(ORDEM_DOS_TIPOS.map((t) => [t, recompensaDe(t, b.nivel)])),
  };
}

// ---------------------------------------------------------------- links

/** Um link https de verdade (sem espaço, sem javascript:), ou nulo. */
export function linkValido(bruto) {
  const s = String(bruto ?? "").trim();
  if (!s || s.length > LIMITES_DO_ACERVO.link || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** O vídeo de um link do YouTube ou do Vimeo: { plataforma, id, embed, miniatura } ou nulo. */
export function videoDoLink(bruto) {
  const s = linkValido(bruto);
  if (!s) return null;
  const u = new URL(s);
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m?.[1] || null;
    }
  }
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return { plataforma: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}`, miniatura: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{6,12})(?:$|\/)/);
    if (m) return { plataforma: "vimeo", id: m[1], embed: `https://player.vimeo.com/video/${m[1]}`, miniatura: null };
  }
  return null;
}

// ---------------------------------------------------------------- envio

/** O título comparável: minúsculo, sem acento, sem pontuação. */
export function normalizarTitulo(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** A chave que acusa duplicado: o mesmo vídeo, ou o mesmo título no mesmo tipo. */
export function chaveDoMaterial({ tipo, titulo, video }) {
  return video ? `video:${video.plataforma}:${video.id}` : `${tipo}:${normalizarTitulo(titulo)}`;
}

function sumarioValido(bruto, paginas) {
  if (!Array.isArray(bruto)) return [];
  return bruto.slice(0, LIMITES_DO_ACERVO.itensDoSumario).map((i) => ({
    titulo: textoDoAcervo(i?.titulo, 200), pagina: inteiro(i?.pagina), nivel: Math.min(6, Math.max(1, inteiro(i?.nivel) || 1)),
  })).filter((i) => i.titulo && i.pagina >= 1 && i.pagina <= paginas);
}

/**
 * Confere um envio. `bruto`: { tipo, titulo, autores, categoria, assunto, descricao, link, capa,
 * pdf: { tamanho, paginas, hash, sumario } }. Livro: PDF. Artigo: PDF ou link. Vídeos: link do
 * YouTube ou do Vimeo. A capa (opcional) é um data URL de imagem pequena — a do PDF é a 1ª página.
 */
export function validarMaterial(bruto) {
  const erros = [];
  const tipo = String(bruto?.tipo || "");
  const def = TIPOS_DE_MATERIAL[tipo];
  if (!def) return { ok: false, erros: ["escolha o tipo do material"] };
  const titulo = textoDoAcervo(bruto?.titulo, LIMITES_DO_ACERVO.titulo);
  if (titulo.length < 3) erros.push("dê um nome ao material (3 letras ou mais)");
  const categoria = CATEGORIAS_DO_ACERVO.includes(bruto?.categoria) ? bruto.categoria : null;
  if (!categoria) erros.push("escolha uma categoria");
  const assunto = textoDoAcervo(bruto?.assunto, LIMITES_DO_ACERVO.assunto);
  if (assunto.length < 2) erros.push("diga o assunto");

  let pdf = null, link = null, video = null;
  const querPdf = def.formato === "pdf" || (def.formato === "pdf-ou-link" && bruto?.pdf);
  if (querPdf) {
    const tamanho = inteiro(bruto?.pdf?.tamanho), paginas = inteiro(bruto?.pdf?.paginas);
    const hash = /^[a-f0-9]{64}$/.test(String(bruto?.pdf?.hash || "")) ? bruto.pdf.hash : null;
    if (!tamanho) erros.push("escolha o PDF");
    else if (tamanho > LIMITES_DO_ACERVO.arquivo) erros.push("o PDF passa de 50 MB");
    if (tamanho && (!paginas || paginas < 1)) erros.push("não consegui ler as páginas do PDF");
    else if (paginas > LIMITES_DO_ACERVO.paginas) erros.push(`o PDF tem mais de ${LIMITES_DO_ACERVO.paginas} páginas`);
    if (tamanho && !hash) erros.push("não consegui conferir o PDF");
    pdf = { tamanho, paginas, hash, sumario: sumarioValido(bruto?.pdf?.sumario, paginas) };
  } else if (def.formato === "video") {
    video = videoDoLink(bruto?.link);
    if (!video) erros.push("cole o link do vídeo (YouTube ou Vimeo)");
    else link = linkValido(bruto.link);
  } else {
    link = linkValido(bruto?.link);
    if (!link) erros.push("anexe o PDF ou cole o link do artigo");
  }
  const capa = typeof bruto?.capa === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(bruto.capa) && bruto.capa.length <= LIMITES_DO_ACERVO.capa
    ? bruto.capa : null;
  const material = {
    tipo, titulo, categoria, assunto, pdf, link, video, capa,
    autores: textoDoAcervo(bruto?.autores, LIMITES_DO_ACERVO.autores),
    descricao: String(bruto?.descricao ?? "").trim().slice(0, LIMITES_DO_ACERVO.descricao),
  };
  return { ok: erros.length === 0, erros, material, chave: chaveDoMaterial(material) };
}

// ---------------------------------------------------------------- revisão e gorjeta

/**
 * Pode revisar? Só bibliotecário, só o que está pendente — e ninguém aprova o próprio envio, a não
 * ser quando é o único bibliotecário (o dono sendo também o líder da semana).
 */
export function podeRevisar({ usuarioId, material, bibliotecarios = [] }) {
  if (!bibliotecarios.some((b) => b.id === usuarioId)) return { ok: false, motivo: "só o bibliotecário revisa os envios" };
  if (!material || material.status !== "pendente") return { ok: false, motivo: "esse envio não está esperando revisão" };
  if (material.autor_id === usuarioId && bibliotecarios.some((b) => b.id !== usuarioId)) {
    return { ok: false, motivo: "o seu próprio envio fica para o outro bibliotecário" };
  }
  return { ok: true };
}

/** Pode retirar do acervo? O bibliotecário retira o que está aprovado (uma reclamação, um engano). */
export function podeRetirar({ usuarioId, material, bibliotecarios = [] }) {
  if (!bibliotecarios.some((b) => b.id === usuarioId)) return { ok: false, motivo: "só o bibliotecário retira material do acervo" };
  if (!material || material.status !== "aprovado") return { ok: false, motivo: "só dá para retirar o que está no acervo" };
  return { ok: true };
}

/** Pode agradecer? Uma vez por material, a quem trouxe (não a si mesmo), com uma das gorjetas e com saldo. */
export function podeAgradecer({ usuarioId, material, moedas, saldo, jaAgradeceu }) {
  if (!material || material.status !== "aprovado") return { ok: false, motivo: "esse material não está no acervo" };
  if (material.autor_id === usuarioId) return { ok: false, motivo: "não dá para agradecer a si mesmo" };
  if (jaAgradeceu) return { ok: false, motivo: "você já agradeceu por esse material" };
  if (!GORJETAS.includes(Number(moedas))) return { ok: false, motivo: "escolha a gorjeta" };
  if ((saldo || 0) < Number(moedas)) return { ok: false, motivo: `faltam ${Number(moedas) - Math.floor(saldo || 0)} moedas` };
  return { ok: true, moedas: Number(moedas) };
}

/** O motivo da recusa (obrigatório: quem enviou precisa saber o que mudar). */
export function motivoValido(bruto) {
  const m = textoDoAcervo(bruto, LIMITES_DO_ACERVO.motivo);
  return m.length >= 5 ? m : null;
}
