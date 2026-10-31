// O PERFIL DO CURSO (pedido de 30/10/2026: "quando um usuário cria um curso que não é de
// programação... música, línguas, matemática com parte prática interativa apropriada, além de um
// modo mais abrangente para caber todo tipo de curso"). Proposta em
// https://claude.ai/artifact/ELisFtpFs9CtmDW53QKy96.
//
// A trilha, a teoria, a agenda, os pontos e o Reino não mudam com o perfil. Ele troca três peças da
// prática: o MOTOR do exercício do dia (motores.js), a EVIDÊNCIA que o projeto pede no lugar do
// GitHub e o jeito de a Lisa falar (a professora certa, os exemplos certos). Trilha antiga, sem
// perfil, é de programação — o caminho de antes fica igual. Puro.

import { ORDEM_DAS_EVIDENCIAS } from "./motores.js";

export const PERFIS = {
  programacao: {
    nome: "Programação", emoji: "💻", exemplos: "JavaScript, SQL, React, Python",
    professora: "tutora de programação", motores: ["codigo"], evidencias: [],
    descricao: "Exercício de código com Rodar e projetos entregues pelo GitHub.",
  },
  musica: {
    nome: "Música", emoji: "🎵", exemplos: "violão, piano, canto, teoria musical",
    professora: "professora de música", motores: ["ouvido", "aberto"], evidencias: ["audio", "video", "texto"],
    descricao: "Treino de ouvido corrigido na hora e prática gravada em áudio ou vídeo, ouvida pela Lisa.",
  },
  idiomas: {
    nome: "Idiomas", emoji: "🗣️", exemplos: "inglês, espanhol, francês, português",
    professora: "professora de idiomas", motores: ["ditado", "aberto"], evidencias: ["texto", "audio"],
    descricao: "Ditado com a voz do navegador, redação e pronúncia gravada, corrigidas pela Lisa.",
  },
  matematica: {
    nome: "Matemática e exatas", emoji: "📐", exemplos: "álgebra, cálculo, estatística, física",
    professora: "professora de matemática", motores: ["calculo", "aberto"], evidencias: ["texto", "imagens"],
    descricao: "Lista de contas e expressões conferida sem IA, e resolução no caderno (foto) lida pela Lisa.",
  },
  livre: {
    nome: "Livre", emoji: "🧭", exemplos: "culinária, fotografia, história, oratória",
    professora: "tutora", motores: ["aberto"], evidencias: ["texto", "imagens", "audio", "video"],
    descricao: "Para qualquer tema: missões práticas com entrega em texto, fotos, áudio ou vídeo, avaliadas por critérios.",
  },
};
export const ORDEM_DOS_PERFIS = ["programacao", "musica", "idiomas", "matematica", "livre"];
export const PERFIL_PADRAO = "programacao";
export const perfilValido = (p) => (PERFIS[p] ? p : PERFIL_PADRAO);
export const ehProgramacao = (p) => perfilValido(p) === "programacao";

/** As evidências que o perfil aceita nos projetos e nos desafios abertos (programação: o GitHub). */
export const evidenciasDoPerfil = (perfil) => PERFIS[perfilValido(perfil)].evidencias.filter((e) => ORDEM_DAS_EVIDENCIAS.includes(e));

// Palavras que entregam o perfil pelo nome do tema. Programação é conferida primeiro: "Estatística
// com Python" e "SQL para análise de dados" são de programação. O limite da palavra é por letra
// Unicode: o `\b` do JavaScript não vê "Álgebra" nem "Inglês" como palavras inteiras.
const palavras = (alternativas) => new RegExp(`(?<![\\p{L}\\d])(?:${alternativas})(?![\\p{L}\\d])`, "iu");
const PALAVRAS = {
  programacao: palavras("programa[cç][aã]o|c[oó]digo|javascript|typescript|python|java|kotlin|swift|c\\+\\+|c#|golang|rust|ruby|php|sql|html|css|react|angular|vue|next\\.?js|node(\\.?js)?|express|django|flask|spring|laravel|\\.net|dotnet|api|apis|git|docker|kubernetes|devops|linux|bash|shell|algoritmos?|estruturas? de dados|banco de dados|backend|front-?end|full-?stack|desenvolvimento web|android|flutter|dart|machine learning|ci[eê]ncia de dados|pandas|numpy|linguagem c|vba|power ?bi|dax|fluig|totvs|advpl|webservices?"),
  idiomas: palavras("ingl[eê]s|english|espanhol|espa[nñ]ol|spanish|franc[eê]s|fran[cç]ais|alem[aã]o|deutsch|italiano|japon[eê]s|coreano|mandarim|chin[eê]s|russo|[aá]rabe|hebraico|latim|grego|portugu[eê]s|l[ií]ngua (portuguesa|inglesa|espanhola|estrangeira)|idiomas?|libras|toefl|ielts|toeic|dele|reda[cç][aã]o|gram[aá]tica"),
  musica: palavras("m[uú]sica|musical|viol[aã]o|guitarra|contrabaixo|baixo el[eé]trico|piano|teclado musical|bateria musical|percuss[aã]o|canto|vocal|ukulele|cavaquinho|violino|violoncelo|flauta|saxofone|trompete|clarinete|partitura|solfejo|percep[cç][aã]o musical|teoria musical|harmonia musical|acordes|produ[cç][aã]o musical"),
  matematica: palavras("matem[aá]tica|c[aá]lculo|[aá]lgebra|geometria|trigonometria|estat[ií]stica|probabilidade|aritm[eé]tica|equa[cç][oõ]es|derivadas?|integrais|limites e continuidade|matrizes|vetores|logaritmos?|porcentagem|f[ií]sica|qu[ií]mica|racioc[ií]nio l[oó]gico|enem|vestibular"),
};

/**
 * O perfil pelo nome do tema (o quadro STUDY que vira trilha não passa pela IA do curso). Sem pista
 * nenhuma, vale `padrao` — programação, que é como os quadros STUDY sempre foram tratados.
 */
export function perfilPeloTema(tema, padrao = PERFIL_PADRAO) {
  const t = String(tema ?? "");
  if (PALAVRAS.programacao.test(t)) return "programacao";
  for (const p of ["idiomas", "musica", "matematica"]) if (PALAVRAS[p].test(t)) return p;
  return perfilValido(padrao);
}

// Assuntos de música que pedem treino de ouvido (os outros, como postura ou um ritmo no violão, são de tocar).
const ASSUNTO_DE_OUVIDO = /intervalo|acorde|tr[ií]ade|escala|percep|ouvido|harmonia|tonalidade|cad[eê]ncia|solfejo|teoria/i;

/** O número do dia (dias desde 1970), para alternar o motor de um dia para o outro. */
const numeroDoDia = (dia) => {
  const t = Date.parse(`${dia}T12:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
};

/**
 * O motor do exercício: programação, sempre o código. Nos outros perfis, os motores se alternam de
 * um dia para o outro e de uma rodada para a seguinte (ditado hoje, redação amanhã; na rodada extra,
 * o outro). Música só usa o treino de ouvido quando o assunto é de percepção ou teoria.
 */
export function motorDoExercicio({ perfil, rodada = 1, assunto = null, dia = "" }) {
  const p = perfilValido(perfil);
  let motores = PERFIS[p].motores;
  if (p === "musica" && !ASSUNTO_DE_OUVIDO.test(`${assunto?.titulo || ""} ${assunto?.descricao || ""}`)) motores = ["aberto"];
  return motores[(numeroDoDia(dia) + (Number(rodada) || 1) - 1) % motores.length];
}
