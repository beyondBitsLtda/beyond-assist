// A trava de entrada da Lisa.
//
// Até aqui o endereço dela era aberto: quem tivesse o link entrava. Isso deixou de servir
// quando ela ganhou domínio próprio e o banco passou a morar numa casa.
//
// A sessão é o próprio token do Supabase Auth — um JWT assinado com o `JWT_SECRET` do banco.
// A conferência é feita AQUI, no Worker, checando a assinatura com Web Crypto. A alternativa
// seria perguntar ao Supabase a cada requisição se o token vale, e isso custaria uma viagem de
// ida e volta até a casa do usuário em TODA página — a diferença entre abrir instantâneo e
// esperar meio segundo por clique.
//
// Este arquivo é só lógica: nada de rede, nada de cookie, nada de Next. É o que permite
// `npm run auth-check` exercitar todas as decisões sem subir nada.

import { b64ParaBytes } from "./base64.js";

export const COOKIE_SESSAO = "lisa_sessao";
export const COOKIE_RENOVA = "lisa_renova";

/**
 * Caminhos que NUNCA pedem login, e o motivo de cada um.
 *
 * Esta lista é a parte perigosa do arquivo: esquecer de liberar algo tranca o sistema para
 * fora; liberar demais abre a porta que a gente veio fechar. Por isso cada entrada tem
 * justificativa escrita — se você não souber dizer por que algo está aqui, tire.
 */
export const LIVRES = [
  // A própria tela de login e o que ela chama. Sem isso, login pediria login.
  { prefixo: "/login", motivo: "a tela de login" },
  { prefixo: "/api/auth/", motivo: "entrar e sair" },

  // Chamadas de MÁQUINA, que não têm navegador nem cookie — e que já são autenticadas por
  // segredo próprio dentro de cada rota. Exigir sessão aqui quebraria o relógio e a extensão
  // sem dar erro visível em lugar nenhum.
  { prefixo: "/api/cron/", motivo: "Worker lisa-cron — usa CRON_SECRET / INGEST_SECRET" },
  { prefixo: "/api/lisa-code/", motivo: "extensão do VS Code — usa LISA_EXTENSION_TOKEN" },

  // Só devolve quatro booleanos de configuração. É o que eu uso para saber se a Lisa está de
  // pé sem precisar entrar — e monitoramento que exige login não monitora nada.
  { prefixo: "/api/health", motivo: "checagem de saúde" },

  // O service worker é buscado pelo navegador em contextos onde o cookie pode não ir junto.
  // Bloqueá-lo mata as notificações push de um jeito difícil de diagnosticar.
  { prefixo: "/sw.js", motivo: "service worker das notificações" },

  // O manifesto do app instalável é buscado SEM cookie (o <link rel="manifest"> não manda
  // credencial). Barrado, ele viraria o HTML do login e o Chrome nunca ofereceria instalar.
  // Os ícones moram em /marca/, que o matcher do middleware já deixa de fora.
  { prefixo: "/manifest.webmanifest", motivo: "manifesto do app instalável (Instalar app do Chrome)" },
];

/**
 * Um caminho está livre de login?
 *
 * A comparação não é "começa com", e a diferença importa: com prefixo solto,
 * `/loginhack` entraria por causa de `/login` e `/api/cronometro` por causa de `/api/cron`.
 * Prefixo terminado em barra casa por início; os demais casam exato ou seguidos de barra.
 */
export function ehLivre(caminho) {
  return LIVRES.some((l) =>
    l.prefixo.endsWith("/")
      ? caminho.startsWith(l.prefixo)
      : caminho === l.prefixo || caminho.startsWith(l.prefixo + "/")
  );
}

/** É uma rota de API? Muda a resposta: API recebe 401, página recebe redirecionamento —
 *  um `fetch` que segue redirecionamento devolveria o HTML do login como se fosse dado. */
export function ehApi(caminho) {
  return caminho.startsWith("/api/");
}

// ---- JWT ----------------------------------------------------------------------------------

function base64urlParaBytes(texto) {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const resto = base64.length % 4;
  return b64ParaBytes(resto ? base64 + "=".repeat(4 - resto) : base64);
}

/** Lê o conteúdo do token SEM conferir a assinatura. Serve só para inspeção — nunca para
 *  decidir se alguém entra. Qualquer um forja um payload; o que não se forja é a assinatura. */
export function lerPayload(token) {
  try {
    const partes = String(token || "").split(".");
    if (partes.length !== 3) return null;
    const bytes = base64urlParaBytes(partes[1]);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Quantos segundos faltam para o token expirar. Negativo quer dizer que já venceu. */
export function segundosAteExpirar(payload, agoraSegundos = Math.floor(Date.now() / 1000)) {
  if (!payload || typeof payload.exp !== "number") return -Infinity;
  return payload.exp - agoraSegundos;
}

/**
 * Confere a assinatura do token com o segredo do banco.
 *
 * Devolve `{ ok, payload, motivo }`. O `motivo` existe para o log dizer O QUE deu errado sem
 * revelar o token: "assinatura" e "expirado" pedem ações bem diferentes de quem investiga.
 */
export async function conferirToken(token, segredo, agoraSegundos = Math.floor(Date.now() / 1000)) {
  if (!token) return { ok: false, motivo: "sem token" };
  if (!segredo) return { ok: false, motivo: "SUPABASE_JWT_SECRET não configurada" };

  const partes = String(token).split(".");
  if (partes.length !== 3) return { ok: false, motivo: "formato inválido" };

  let assinatura;
  try {
    assinatura = base64urlParaBytes(partes[2]);
  } catch {
    return { ok: false, motivo: "assinatura ilegível" };
  }

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const confere = await crypto.subtle.verify(
    "HMAC",
    chave,
    assinatura,
    new TextEncoder().encode(`${partes[0]}.${partes[1]}`)
  );
  if (!confere) return { ok: false, motivo: "assinatura não bate" };

  const payload = lerPayload(token);
  if (!payload) return { ok: false, motivo: "conteúdo ilegível" };

  const falta = segundosAteExpirar(payload, agoraSegundos);
  if (falta <= 0) return { ok: false, motivo: "expirado", payload };

  return { ok: true, payload, expiraEm: falta };
}

/**
 * Vale a pena renovar agora?
 *
 * Renovar só depois de expirar deixaria o usuário esperar uma viagem extra bem no meio de um
 * clique. Renovando um pouco antes, a troca acontece numa requisição qualquer e ninguém vê.
 */
export function precisaRenovar(payload, margemSegundos = 300, agoraSegundos = Math.floor(Date.now() / 1000)) {
  return segundosAteExpirar(payload, agoraSegundos) < margemSegundos;
}

// ---- papéis (01/11/2026, o MVP: "quando um usuário que não seja eu logar, ele tem acesso a uma
// versão limitada da aplicação") ----
//
// Dois papéis. ADMIN é o dono da Lisa: entra em tudo, como sempre. USUÁRIO é qualquer outra conta:
// o assistente, a voz, o Modo Tela, o editor de código, o ProcessMap, os repositórios públicos, o
// perfil e as tarefas leves — e nada do que é do admin (Sentinela, Abacato, painéis, chaves,
// comandos remotos, a base de conhecimento dele).

/** Os ids (o "sub" do token) de LISA_ADMINS, separados por vírgula, espaço ou ponto e vírgula. */
export function adminsDe(texto) {
  return String(texto ?? "").split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * O papel de quem está na sessão: "admin" ou "usuario". Admin é quem está em LISA_ADMINS ou tem
 * `app_metadata.role = "admin"` no token — o token é assinado pelo banco, ninguém se promove pelo
 * navegador. Sem LISA_ADMINS configurado, o modo MVP está DESLIGADO e todo mundo é admin, como
 * antes: assim o código entra no ar sem trancar o dono para fora, e o modo liga quando a variável
 * ganha o id dele.
 */
export function papelDe(payload, listaDeAdmins) {
  const admins = adminsDe(listaDeAdmins);
  if (!admins.length) return "admin";
  if (!payload) return "usuario";
  if (payload.app_metadata?.role === "admin") return "admin";
  return admins.includes(String(payload.sub || "").toLowerCase()) ? "admin" : "usuario";
}

/**
 * O que o USUÁRIO alcança — o resto é recusado (lista do que pode, nunca do que não pode: um painel
 * novo nasce fechado para ele). Cada entrada com o motivo, como em LIVRES.
 */
export const DO_USUARIO = [
  // as telas da versão MVP
  { prefixo: "/assistant", motivo: "o assistente em tela cheia (conversa, voz, Modo Tela, editor de código)" },
  { prefixo: "/fluxogramas", motivo: "o ProcessMap — os projetos já são separados por pessoa" },
  // (o /visual, o catálogo de visuais, fica com o admin: o usuário tem só a Esfera de pontos e o Rosto,
  // escolhidos no menu do Assistente — src/lib/visuaisDaLisa.js: VISUAIS_DO_USUARIO)
  { prefixo: "/lisa-task", motivo: "o atalho para a Lisa Task (o Abacato com o visual da Lisa, login próprio)" },
  // o que essas telas chamam
  { prefixo: "/api/ask", motivo: "a conversa — no modo usuário, sem a base, o Abacato, a persona e o contexto do admin" },
  { prefixo: "/api/speak", motivo: "a voz da Lisa" },
  { prefixo: "/api/screen-comment", motivo: "o Modo Tela — no modo usuário, sem gravar no histórico do Vigia" },
  { prefixo: "/api/repos/contexto", motivo: "repositórios como contexto — no modo usuário, só os públicos, sem o token do admin" },
  { prefixo: "/api/diagrama", motivo: "o desenho no quadro" },
  { prefixo: "/api/processmap/", motivo: "o plano e os .md do ProcessMap" },
  { prefixo: "/api/fluxogramas", motivo: "os projetos e fluxogramas da pessoa (filtrados pelo dono)" },
  { prefixo: "/api/notas", motivo: "o Tomar nota (por pessoa)" },
  { prefixo: "/api/perfil", motivo: "a entrevista do primeiro acesso" },
];

const casaCom = (caminho) => (l) => (l.prefixo.endsWith("/")
  ? caminho.startsWith(l.prefixo)
  : caminho === l.prefixo || caminho.startsWith(l.prefixo + "/"));

/**
 * O papel alcança o caminho? Admin, tudo. Usuário, só DO_USUARIO — e os arquivos públicos (um
 * caminho de página que termina em extensão: imagem, som, script da pasta public).
 */
export function podeAcessar(papel, caminho) {
  if (papel === "admin") return true;
  const c = String(caminho || "");
  if (DO_USUARIO.some(casaCom(c))) return true;
  return !c.startsWith("/api/") && /\/[^/]+\.[a-z0-9]{2,5}$/i.test(c);
}

/** O cookie que diz o papel à tela (só para esconder o que o usuário não usa — quem barra é o portão). */
export const COOKIE_PAPEL = "lisa_papel";

/** Para onde mandar depois de entrar. Só aceita caminho interno — sem isso, um link
 *  `?de=https://site-falso` faria a própria Lisa despejar o usuário lá depois do login. */
export function destinoSeguro(bruto) {
  const valor = String(bruto || "");
  if (!valor.startsWith("/")) return "/";
  if (valor.startsWith("//")) return "/";   // "//host" é endereço externo disfarçado
  if (valor.startsWith("/login")) return "/";
  // /auth-check não é uma tela: responde 204 vazio. Quem cai no login vindo dela foi mandado
  // pelo Caddy (ver src/app/auth-check/route.js), e devolver a pessoa para um corpo vazio
  // depois de entrar pareceria que o login falhou.
  if (valor.startsWith("/auth-check")) return "/";
  return valor;
}
