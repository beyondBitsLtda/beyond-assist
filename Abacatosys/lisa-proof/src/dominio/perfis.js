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
import { motoresComDiagrama } from "./diagramas.js";

export const PERFIS = {
  programacao: {
    nome: "Programação", emoji: "💻", exemplos: "JavaScript, SQL, React, Python",
    professora: "tutora de programação", motores: ["codigo"], evidencias: [],
    descricao: "Exercício de código com Rodar e projetos entregues pelo GitHub; nos cursos de arquitetura e computação, diagramas desenhados no quadro.",
  },
  musica: {
    nome: "Música", emoji: "🎵", exemplos: "violão, piano, canto, teoria musical",
    professora: "professora de música", motores: ["ouvido", "leitura", "ritmo", "afinacao", "aberto"], evidencias: ["audio", "video", "texto"],
    descricao: "Treino de ouvido, leitura na pauta, ritmo no metrônomo e afinação no microfone, corrigidos na hora; prática gravada em áudio ou vídeo, ouvida pela Lisa.",
  },
  idiomas: {
    nome: "Idiomas", emoji: "🗣️", exemplos: "inglês, espanhol, francês, português",
    professora: "professora de idiomas", motores: ["ditado", "conversa", "aberto"], evidencias: ["texto", "audio", "pdf"],
    descricao: "Ditado com a voz do navegador, conversa com a Lisa numa situação do dia a dia, redação e pronúncia gravada, corrigidas pela Lisa.",
  },
  matematica: {
    nome: "Matemática e exatas", emoji: "📐", exemplos: "álgebra, cálculo, estatística, física",
    professora: "professora de matemática", motores: ["calculo", "passos", "grafico", "aberto"], evidencias: ["texto", "imagens", "pdf"],
    descricao: "Lista de contas, passo a passo conferido linha a linha e gráficos de arrastar, sem IA; resolução no caderno (foto ou PDF) lida pela Lisa.",
  },
  livre: {
    nome: "Livre", emoji: "🧭", exemplos: "culinária, fotografia, história, oratória",
    professora: "tutora", motores: ["aberto"], evidencias: ["texto", "imagens", "audio", "video", "pdf"],
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

// Os motores de música pelo assunto: percepção e teoria treinam o ouvido (e cantar o que se ouve);
// ritmo treina o metrônomo; canto treina a afinação; o resto (postura, uma peça) é tocar e gravar,
// com o ritmo de vez em quando — todo músico precisa dele.
const ASSUNTO_DE_OUVIDO = /intervalo|acorde|tr[ií]ade|escala|percep|ouvido|harmonia|tonalidade|cad[eê]ncia|solfejo|teoria/i;
const ASSUNTO_DE_RITMO = /ritmo|r[ií]tmic|compasso|metr[oô]nomo|andamento|pulsa[cç][aã]o|batida|levada|colch|sem[ií]nima|m[ií]nima|s[ií]ncop|groove|bateria|percuss/i;
const ASSUNTO_DE_CANTO = /canto|cantar|vocal|voz|afina[cç][aã]o|afinad|respira[cç][aã]o|aquecimento vocal/i;
const ASSUNTO_DE_LEITURA = /leitura|partitura|pauta|clave|pentagrama|nomes? das notas|figuras musicais/i;

export function motoresDaMusica(assunto) {
  const t = `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;
  if (ASSUNTO_DE_LEITURA.test(t)) return ["leitura", "aberto"];
  if (ASSUNTO_DE_RITMO.test(t)) return ["ritmo", "aberto"];
  if (ASSUNTO_DE_CANTO.test(t)) return ["afinacao", "aberto"];
  if (ASSUNTO_DE_OUVIDO.test(t)) return ["ouvido", "leitura", "afinacao", "aberto"];
  return ["aberto", "ritmo"];
}

// Os motores de matemática pelo assunto: gráfico para funções, retas e parábolas; passo a passo para
// equações, expressões e fatoração; a lista de contas e o desafio aberto servem a tudo.
const ASSUNTO_DE_GRAFICO = /gr[aá]fico|fun[cç][aã]o (afim|linear|quadr[aá]tica)|fun[cç][oõ]es|reta|par[aá]bola|plano cartesiano|coordenad|v[eé]rtice/i;
const ASSUNTO_DE_PASSOS = /equa[cç]|express[aã]o|express[oõ]es|fatora|simplifica|produtos not[aá]veis|polin[oô]mi|[aá]lgebra|inequa|isolar/i;

export function motoresDaMatematica(assunto) {
  const t = `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;
  const motores = ["calculo"];
  if (ASSUNTO_DE_PASSOS.test(t)) motores.push("passos");
  if (ASSUNTO_DE_GRAFICO.test(t)) motores.push("grafico");
  return [...motores, "aberto"];
}

/** O número do dia (dias desde 1970), para alternar o motor de um dia para o outro. */
const numeroDoDia = (dia) => {
  const t = Date.parse(`${dia}T12:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
};

/**
 * O motor do exercício: programação, o código (e o desenho, na área de arquitetura). Nos outros
 * perfis, os motores se alternam de um dia para o outro e de uma rodada para a seguinte (ditado
 * hoje, redação amanhã; na rodada extra, o outro). Música escolhe entre ouvido, ritmo, afinação e o desafio aberto pelo assunto (motoresDaMusica).
 * Programação e livre ganham o exercício de desenhar (fluxo, modelo de dados, arquitetura) quando o
 * curso ou o assunto é da área (src/dominio/diagramas.js: motoresComDiagrama).
 */
export function motorDoExercicio({ perfil, rodada = 1, assunto = null, dia = "", tema = "" }) {
  const p = perfilValido(perfil);
  let motores = PERFIS[p].motores;
  if (p === "musica") motores = motoresDaMusica(assunto);
  if (p === "matematica") motores = motoresDaMatematica(assunto);
  if (p === "programacao" || p === "livre") motores = motoresComDiagrama(motores, { tema, assunto });
  return motores[(numeroDoDia(dia) + (Number(rodada) || 1) - 1) % motores.length];
}
