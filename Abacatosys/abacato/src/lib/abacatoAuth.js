// Autenticação do Abacato — própria, e separada da Lisa por exigência.
//
// POR QUE NÃO O SUPABASE AUTH, já que o banco é o mesmo:
// ele tem UMA tabela de usuários por projeto. Usá-lo faria qualquer login da Lisa valer aqui
// dentro, que é exatamente o que não se quer. Daí a tabela `abacato_usuarios` e este arquivo.
//
// POR QUE PBKDF2 E NÃO BCRYPT, que seria a escolha usual:
// este código roda nos dois lugares — Node, no iMac, e workerd, na Cloudflare. O bcrypt é um
// módulo nativo e não existe no Worker. PBKDF2 vem no WebCrypto, que os dois têm. Menos
// resistente a GPU que bcrypt ou argon2, e é o preço de rodar no mesmo código nos dois lados;
// as 210 mil iterações compensam parte disso (recomendação do OWASP para PBKDF2-SHA512).
//
// Tudo aqui é sem estado: a sessão é um cookie assinado, conferido em cada requisição sem ida
// ao banco. Guardar sessão em tabela custaria uma consulta por clique.

const ITERACOES = 210_000;
const TAMANHO_SAL = 16;
const TAMANHO_CHAVE = 32;

export const COOKIE_SESSAO = "abacato_sessao";

const enc = new TextEncoder();

function paraBase64(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64(texto) {
  const b64 = String(texto || "").replace(/-/g, "+").replace(/_/g, "/");
  const resto = b64.length % 4;
  const bin = atob(resto ? b64 + "=".repeat(4 - resto) : b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Compara em tempo constante.
 *
 * Sair no primeiro byte diferente parece economia e é vazamento: o tempo de resposta contaria
 * quantos bytes já batem, e o segredo sairia um byte por vez. O comprimento pode diferir sem
 * problema — ele não é segredo, o conteúdo é.
 */
function iguaisEmTempoConstante(a, b) {
  const x = typeof a === "string" ? enc.encode(a) : new Uint8Array(a);
  const y = typeof b === "string" ? enc.encode(b) : new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diferenca = 0;
  for (let i = 0; i < x.length; i++) diferenca |= x[i] ^ y[i];
  return diferenca === 0;
}

/* ==========================================================================================
 * QUEM CALCULA A SENHA É O NAVEGADOR, NÃO O SERVIDOR.
 *
 * Esta é a decisão menos óbvia do sistema, e ela veio de uma medição. Com o cálculo no
 * servidor, o Worker da Cloudflare respondia `error code: 1102` — estouro de CPU — depois de
 * três ou quatro logins seguidos. Cada login custava ~150ms de CPU, e o orçamento de um Worker
 * é de ~10ms por requisição: ele tolera rajadas curtas e depois corta.
 *
 * Pior que a instabilidade: o login calcula a senha MESMO para e-mail inexistente, senão o
 * tempo de resposta diria quem tem conta aqui. Com o cálculo no servidor, qualquer pessoa de
 * fora derrubava o sistema mandando logins errados — de graça.
 *
 * Então o trabalho pesado mudou de lado. O navegador estica a senha e manda a CHAVE DERIVADA;
 * o servidor guarda um HMAC dela e compara. É o desenho do Bitwarden e do 1Password.
 *
 * O que muda e o que não muda:
 *
 *   BANCO VAZADO       igual de difícil. Para achar a senha a partir do que está guardado,
 *                      o atacante ainda precisa passar pelas 210 mil iterações por tentativa.
 *                      O HMAC é barato, mas a entrada dele tem 256 bits — força bruta direta
 *                      na chave não existe.
 *
 *   EM TRÂNSITO        igual. A chave derivada viaja no lugar da senha e vale o mesmo que ela;
 *                      quem intercepta o HTTPS de um já interceptaria o outro.
 *
 *   CPU DO SERVIDOR    de ~150ms para microssegundos. E o ataque de queimar CPU com logins
 *                      falsos deixa de existir, porque o servidor não faz mais trabalho pesado.
 *
 *   SENHA NO SERVIDOR  ele nunca mais vê a senha em texto puro. É um ganho de brinde.
 * ========================================================================================== */

/**
 * O sal do lado do cliente é DERIVADO DO E-MAIL, não sorteado.
 *
 * Tem de ser assim: o navegador precisa do sal ANTES de falar com o servidor, e uma rota que
 * entregasse o sal de cada e-mail seria uma lista de quem tem conta aqui — bastaria perguntar.
 *
 * Um sal previsível é um sal mais fraco que um sorteado, e o que ele precisa garantir continua
 * garantido: duas pessoas com a mesma senha têm chaves diferentes, e uma tabela pré-calculada
 * só serve para UM e-mail. O prefixo fixo separa estas chaves das de qualquer outro sistema
 * que use a mesma ideia.
 */
async function salDoCliente(email) {
  const texto = "abacato:" + String(email || "").trim().toLowerCase();
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
}

/**
 * A chave que o navegador manda no lugar da senha.
 *
 * O número de iterações é uma CONSTANTE, e não um valor por usuário: o navegador precisa dele
 * antes de qualquer ida ao servidor, e buscá-lo por e-mail recriaria a lista de quem tem conta.
 * Mudá-lo obriga todo mundo a cadastrar a senha de novo — está escrito aqui para quem for
 * mexer saber o preço antes.
 */
export async function chaveDeLogin(email, senha, iteracoes = ITERACOES) {
  if (!email || !senha) return null;
  return paraBase64(await derivar(senha, await salDoCliente(email), iteracoes));
}

/** O selo que o servidor guarda: HMAC da chave, com um sal sorteado por usuário. Barato de
 *  calcular porque a entrada já vem esticada — o custo contra quem ataca está na chave. */
async function selar(chave, sal) {
  const k = await crypto.subtle.importKey("raw", sal, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(chave));
}

/** Guarda uma chave recém-criada. O sal é sorteado: sem ele, duas pessoas com a mesma senha
 *  teriam o mesmo selo, e o banco vazado entregaria de graça quem repetiu senha com quem. */
export async function guardarChave(chave, iteracoes = ITERACOES) {
  const sal = crypto.getRandomValues(new Uint8Array(TAMANHO_SAL));
  return { hash: paraBase64(await selar(chave, sal)), sal: paraBase64(sal), iteracoes };
}

/** A chave recebida bate com o que está guardado? */
export async function conferirChave(chave, { hash, sal }) {
  if (!chave || !hash || !sal) return false;
  try {
    return iguaisEmTempoConstante(new Uint8Array(await selar(chave, deBase64(sal))), deBase64(hash));
  } catch {
    return false;
  }
}

/** Senha → o que se guarda, de ponta a ponta. Só para quem CRIA a conta: o servidor nunca roda
 *  isto, porque ele nunca recebe a senha. */
export async function guardarSenha(email, senha, iteracoes = ITERACOES) {
  return guardarChave(await chaveDeLogin(email, senha, iteracoes), iteracoes);
}

/**
 * Deriva a chave em RODADAS, e não numa chamada só.
 *
 * O motivo é uma trava da plataforma, medida e não suposta:
 *
 *     Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000).
 *
 * O workerd da Cloudflare recusa PBKDF2 acima de cem mil iterações. É pior do que parece: o
 * `conferirSenha` engole qualquer erro e devolve `false`, então o sintoma não foi um erro de
 * criptografia — foi "e-mail ou senha incorretos" num sistema em que a senha estava certa. O
 * banco respondia, as variáveis estavam gravadas, e ninguém entrava.
 *
 * As duas saídas óbvias são ruins. Baixar para cem mil joga fora metade do custo de um ataque
 * de força bruta. Usar contas diferentes em cada servidor é impossível: o MESMO hash precisa
 * conferir no Node do iMac e no workerd da Cloudflare.
 *
 * Então o total é dividido em rodadas, cada uma abaixo da trava, encadeadas: a saída de uma
 * vira a entrada da próxima. O trabalho total continua sendo o número pedido — 210 mil viram
 * três rodadas de 70 mil — e quem ataca paga exatamente o mesmo. Não há primitiva nova aqui:
 * é o PBKDF2 padrão, chamado mais de uma vez.
 *
 * O número de rodadas sai do próprio total guardado, sem coluna nova: qualquer valor até cem
 * mil dá UMA rodada, igualzinho ao que este código fazia antes. Hashes antigos com cem mil ou
 * menos continuam conferindo sem nenhuma migração.
 */
const MAXIMO_POR_RODADA = 100_000;

async function derivar(senha, sal, iteracoes) {
  const rodadas = Math.max(1, Math.ceil(iteracoes / MAXIMO_POR_RODADA));
  const porRodada = Math.ceil(iteracoes / rodadas);

  let material = enc.encode(senha);
  let bits = null;
  for (let i = 0; i < rodadas; i++) {
    const chave = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: sal, iterations: porRodada, hash: "SHA-512" },
      chave,
      TAMANHO_CHAVE * 8
    );
    material = new Uint8Array(bits);
  }
  return bits;
}

/**
 * A criptografia funciona NESTE servidor?
 *
 * Existe porque `conferirSenha` engole qualquer erro e devolve `false` — o que é certo no
 * login (um erro não pode se distinguir de uma senha errada) e péssimo para diagnosticar. Sem
 * isto, uma falha de PBKDF2 no workerd aparece como "e-mail ou senha incorretos", e a busca
 * vai parar no banco, que está perfeito.
 *
 * Não toca em usuário nenhum: cria uma senha descartável e a confere contra ela mesma.
 */
export async function testarCripto(iteracoes = ITERACOES) {
  const comeco = Date.now();
  try {
    // Faz o caminho inteiro: o que o navegador calcula e o que o servidor compara. Rodar isto
    // num Worker custa CPU de verdade — por isso a rota de saúde só o chama quando pedido.
    const email = "diagnostico@abacato";
    const chave = await chaveDeLogin(email, "senha-descartavel-de-diagnostico", iteracoes);
    const guardada = await guardarChave(chave, iteracoes);
    const certa = await conferirChave(chave, guardada);
    const errada = await conferirChave(await chaveDeLogin(email, "outra-coisa", iteracoes), guardada);
    return { ok: certa && !errada, ms: Date.now() - comeco, iteracoes };
  } catch (e) {
    return { ok: false, ms: Date.now() - comeco, iteracoes, erro: String(e?.message || e) };
  }
}

/**
 * O custo que o SERVIDOR paga por login, sozinho.
 *
 * Separado do de cima de propósito: é este número que precisa caber no orçamento de CPU do
 * Worker, e misturá-lo com o cálculo do navegador foi exatamente o que escondeu o problema.
 */
export async function testarCriptoDoServidor() {
  const comeco = Date.now();
  try {
    const chave = "x".repeat(43);
    const guardada = await guardarChave(chave);
    const ok = (await conferirChave(chave, guardada)) && !(await conferirChave("y".repeat(43), guardada));
    return { ok, ms: Date.now() - comeco };
  } catch (e) {
    return { ok: false, ms: Date.now() - comeco, erro: String(e?.message || e) };
  }
}

// ---- sessão ------------------------------------------------------------------------------

/**
 * O cookie de sessão: `payload.assinatura`, assinado com HMAC-SHA256.
 *
 * Mesma ideia do JWT, sem a biblioteca — precisamos de três campos e de uma assinatura, e o
 * formato completo traria um analisador inteiro para dentro do Worker sem nada em troca.
 *
 * O `exp` vai DENTRO do payload assinado, e não só no `Max-Age` do cookie. O Max-Age é uma
 * sugestão ao navegador: quem guarda o valor e manda de volta depois não é impedido por ele.
 */
export async function criarSessao(usuario, segredo, duracaoSegundos = 60 * 60 * 24 * 7) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    exp: Math.floor(Date.now() / 1000) + duracaoSegundos,
  };
  const corpo = paraBase64(enc.encode(JSON.stringify(payload)));
  return `${corpo}.${paraBase64(await assinar(corpo, segredo))}`;
}

/** Devolve `{ ok, usuario, motivo }`. Nunca levanta — quem chama decide o que fazer. */
export async function lerSessao(cookie, segredo) {
  if (!cookie) return { ok: false, motivo: "sem sessão" };
  if (!segredo) return { ok: false, motivo: "ABACATO_SESSAO_SECRET não configurada no servidor" };

  const [corpo, assinatura] = String(cookie).split(".");
  if (!corpo || !assinatura) return { ok: false, motivo: "formato inválido" };

  const esperada = paraBase64(await assinar(corpo, segredo));
  if (!iguaisEmTempoConstante(assinatura, esperada)) return { ok: false, motivo: "assinatura não bate" };

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(deBase64(corpo)));
  } catch {
    return { ok: false, motivo: "conteúdo ilegível" };
  }

  if (!payload?.exp || payload.exp * 1000 < Date.now()) return { ok: false, motivo: "expirada", usuario: payload };
  return { ok: true, usuario: payload };
}

async function assinar(texto, segredo) {
  const chave = await crypto.subtle.importKey(
    "raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", chave, enc.encode(texto));
}

/**
 * Caminhos que não pedem login, cada um com o motivo escrito.
 *
 * Esta lista é a parte perigosa do arquivo: esquecer de liberar algo tranca o sistema para
 * fora, liberar demais abre a porta que ele veio fechar. Se você não souber dizer por que uma
 * entrada está aqui, tire.
 */
export const LIVRES = [
  { prefixo: "/entrar", motivo: "a própria tela de login" },
  { prefixo: "/api/auth/", motivo: "entrar e sair" },
  { prefixo: "/api/saude", motivo: "checagem de saúde — monitoramento que exige login não monitora" },
  // O link público de acompanhamento que o cliente abre SEM conta. É o motivo de o Abacato
  // existir, e por isso mora numa rota própria, separada de tudo que exige sessão.
  { prefixo: "/publico/", motivo: "dashboard compartilhado com cliente, sem conta" },
  { prefixo: "/api/publico/", motivo: "dados do dashboard compartilhado" },
  // O cadastro por convite. Quem abre este endereço AINDA NÃO TEM CONTA — exigir login aqui
  // seria exigir a conta que a pessoa está tentando criar. O que protege esta porta é o token
  // sorteado do convite, e o fato de a conta nascer sem aprovação: ela não alcança nada até
  // alguém de dentro liberar.
  { prefixo: "/cadastro/", motivo: "criar a própria conta a partir de um convite" },
  { prefixo: "/api/cadastro/", motivo: "conferir o convite e criar a conta que espera aprovação" },
];

/** Comparação por palavra inteira, não por prefixo solto: `/entrarhack` não pode entrar por
 *  causa de `/entrar`, nem `/api/authorize` por causa de `/api/auth`. */
export function ehLivre(caminho) {
  return LIVRES.some((l) =>
    l.prefixo.endsWith("/")
      ? caminho.startsWith(l.prefixo)
      : caminho === l.prefixo || caminho.startsWith(l.prefixo + "/")
  );
}

export function ehApi(caminho) {
  return caminho.startsWith("/api/");
}

/** Para onde mandar depois de entrar. Só caminho interno — sem isto, `?de=https://site-falso`
 *  faria o próprio Abacato despejar o usuário lá depois do login. */
export function destinoSeguro(bruto) {
  const valor = String(bruto || "");
  if (!valor.startsWith("/")) return "/";
  if (valor.startsWith("//")) return "/";
  if (valor.startsWith("/entrar")) return "/";
  return valor;
}
