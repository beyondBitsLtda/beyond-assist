// Decide quais comandos a Lisa pode rodar sozinha no terminal e quais precisam do seu aval.
//
// Isolado do resto de propósito: é a única peça da extensão em que um engano custa caro, e
// aqui ela pode ser exercitada caso a caso, sem abrir o VS Code (ver scripts/comandos-check.mjs
// na raiz do projeto).
//
// A ideia não é adivinhar a intenção do comando — é impossível e falharia calado. É reconhecer
// um conjunto PEQUENO de comandos rotineiros de desenvolvimento e mandar todo o resto para
// confirmação. Um falso "precisa confirmar" custa um clique; um falso "pode rodar" pode custar
// o dia de trabalho.

/** Comandos de rotina que rodam sem perguntar. Editável em Configurações → Lisa Code. */
export const PERMITIDOS_PADRAO = [
  // leitura e navegação
  "ls", "dir", "pwd", "cat", "type", "head", "tail", "wc", "find", "grep", "rg", "which", "where",
  // git que só lê
  "git status", "git log", "git diff", "git branch", "git show", "git remote", "git stash list",
  // rotina de projeto
  "npm run", "npm test", "npm ci", "npm install", "npm list", "npx tsc", "node", "python", "python3",
  "pnpm", "yarn", "tsc", "jest", "vitest", "eslint", "prettier",
];

/**
 * Coisas que NUNCA rodam sozinhas, mesmo que casem com algo da lista de permitidos.
 *
 * Isto não é paranoia genérica: cada linha aqui é um jeito conhecido de transformar um comando
 * de aparência inocente em perda de trabalho. `git checkout .` e `git reset --hard` descartam
 * alterações não salvas em silêncio; `npm install` com `>` redirecionado pode sobrescrever um
 * arquivo; `curl ... | sh` executa o que vier da rede.
 */
const NUNCA_SOZINHO = [
  /\brm\b/, /\brmdir\b/, /\bdel\b/, /\bformat\b/, /\bmkfs\b/,
  /\bsudo\b/, /\bsu\b/, /\bchmod\b/, /\bchown\b/, /\bicacls\b/,
  /\bgit\s+(reset|checkout|clean|push|rebase|revert|filter-branch)\b/,
  /\bshutdown\b/, /\breboot\b/, /\bkill\b/, /\btaskkill\b/,
  /\bdd\b/, /\bcurl\b.*\|/, /\bwget\b.*\|/, /\biwr\b.*\|/,
  /\bnpm\s+publish\b/, /\bdocker\b/, /\bsystemctl\b/,
];

/**
 * Caracteres que encadeiam ou redirecionam. Um comando com eles sai da lista de permitidos
 * mesmo que comece com algo inofensivo.
 *
 * Sem esta regra a lista seria teatro: `ls && rm -rf .` começa com `ls`, e `npm test > .env`
 * começa com `npm test`. É a checagem que faz as outras duas valerem alguma coisa.
 */
const ENCADEIA = /[;&|><`$(){}]|\n/;

export type Veredito = {
  liberado: boolean;
  /** Por que precisa confirmar — mostrado no diálogo, para a decisão não ser às cegas. */
  motivo?: string;
};

export function avaliarComando(comando: string, permitidos: string[] = PERMITIDOS_PADRAO): Veredito {
  const cmd = String(comando || "").trim();
  if (!cmd) return { liberado: false, motivo: "comando vazio" };

  if (ENCADEIA.test(cmd)) {
    return { liberado: false, motivo: "encadeia ou redireciona (; && | > $ ...)" };
  }
  for (const padrao of NUNCA_SOZINHO) {
    if (padrao.test(cmd)) return { liberado: false, motivo: "pode apagar, elevar privilégio ou publicar" };
  }

  const alvo = cmd.toLowerCase();
  const casou = permitidos.some((p) => {
    const prefixo = p.toLowerCase().trim();
    // Prefixo tem que terminar em fim de palavra: "node" não pode liberar "nodemon-malicioso",
    // e "npm run" não pode liberar "npm runtime-qualquer-coisa".
    return alvo === prefixo || alvo.startsWith(prefixo + " ");
  });

  return casou ? { liberado: true } : { liberado: false, motivo: "não está na lista de comandos liberados" };
}
