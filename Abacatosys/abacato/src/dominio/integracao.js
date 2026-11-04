// Integrações: outro SISTEMA (não uma pessoa) lendo um quadro e criando card nele.
//
// A primeira é o Beyond-Lead, que prospecta empresas e manda cada uma como card para o quadro
// do CRM, e lê o quadro de volta para montar o funil. Ele não tem conta aqui e não deveria ter:
// uma conta é uma pessoa, com senha esticada no navegador e sessão de uma semana. Um sistema
// precisa de outra coisa — uma chave que abre UM quadro, e só para o que foi combinado.
//
// Este arquivo não fala com banco nem com rede: são as regras, para poderem ser conferidas
// sozinhas (`npm run integracao-check`).

/** Prefixo visível do token. Ele não protege nada — serve para quem achar a string num log ou
 *  num .env saber na hora o que ela é e de onde revogar. */
export const PREFIXO_TOKEN = "abi_";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Token novo: 40 caracteres sorteados (~230 bits). Só letras e números, para sobreviver a
 *  qualquer campo de segredo e a um copiar-e-colar sem aspas. */
export function gerarToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  return PREFIXO_TOKEN + [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

/**
 * O que o banco guarda: o SHA-256 do token, nunca o token.
 *
 * O link público de painel guarda o token em claro, e ali é aceitável — ele só LÊ contagens.
 * Este abre descrições inteiras (telefone, valores de proposta) e CRIA cards. Um backup do
 * banco que vazasse não pode virar a chave de entrada. E SHA-256 simples basta, sem as 210 mil
 * iterações da senha: o token é sorteado com 230 bits, não escolhido por gente, e não existe
 * dicionário para tentar.
 */
export async function hashDoToken(token) {
  const dados = new TextEncoder().encode(String(token || ""));
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lê `Authorization: Bearer abi_...`. Qualquer outro formato é "sem token" — inclusive o
 *  token sem o prefixo, que só pode ser um erro de cópia. */
export function tokenDoCabecalho(valor) {
  const m = String(valor || "").match(/^Bearer\s+(\S+)$/i);
  if (!m || !m[1].startsWith(PREFIXO_TOKEN) || m[1].length < PREFIXO_TOKEN.length + 32) return null;
  return m[1];
}

/** "Clínica Sorriso LTDA" e "clinica  sorriso ltda." são a mesma empresa. */
export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** O site sem o que muda de um cadastro para outro: protocolo, `www.` e a barra do fim. */
export function normalizarSite(site) {
  const s = String(site || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  return s.length >= 4 ? normalizar(s) : "";
}

/**
 * Esse lead já está no quadro?
 *
 * Três jeitos de ser o mesmo, do mais certo para o mais solto:
 *   1. mesma origem e mesmo id de origem (o placeId do Google, quando veio do Beyond-Lead);
 *   2. mesmo título, depois de normalizado;
 *   3. o site do lead aparece na descrição de um card.
 *
 * Olha o QUADRO INTEIRO, não só a coluna de entrada: uma empresa que já está em "Proposta" não
 * pode voltar para "Alvos" só porque apareceu de novo numa busca. No Trello a conferência era
 * só na lista de alvos, e era por isso que lead avançado voltava duplicado.
 */
export function acharDuplicado(cards, { titulo, site, origem, origemId }) {
  const nTitulo = normalizar(titulo);
  const nSite = normalizarSite(site);

  for (const c of cards || []) {
    if (origemId && c.origem === origem && c.origem_id === String(origemId)) {
      return { id: c.id, titulo: c.titulo, motivo: "origem" };
    }
  }
  for (const c of cards || []) {
    if (nTitulo && normalizar(c.titulo) === nTitulo) return { id: c.id, titulo: c.titulo, motivo: "titulo" };
    if (nSite && normalizar(c.descricao).includes(nSite)) return { id: c.id, titulo: c.titulo, motivo: "site" };
  }
  return null;
}

/** Limites do card que chega de fora. O quadro é de gente: um sistema com defeito mandando um
 *  título de 50 mil caracteres não pode quebrar a tela de todo mundo. */
export const LIMITES = { titulo: 200, descricao: 20000, origemId: 200 };
