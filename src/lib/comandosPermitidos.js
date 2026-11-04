// A mesma decisão de comandosPermitidos.ts, do lado do SERVIDOR.
//
// Existe em dois lugares de propósito, e não por descuido. A extensão decide antes de rodar um
// comando na máquina do usuário; o servidor decide de novo antes de rodar um no iMac. Confiar
// só no cliente seria confiar em quem chama a rota — e quem chama a rota é qualquer um com o
// token, não necessariamente a extensão.
//
// Duas cópias divergem em silêncio. Por isso `npm run comandos-check` roda a MESMA bateria
// contra as duas e reprova na primeira diferença.

/** Comandos de rotina que rodam sem perguntar. */
export const PERMITIDOS_PADRAO = [
  "ls", "dir", "pwd", "cat", "type", "head", "tail", "wc", "find", "grep", "rg", "which", "where",
  "git status", "git log", "git diff", "git branch", "git show", "git remote", "git stash list",
  "npm run", "npm test", "npm ci", "npm install", "npm list", "npx tsc", "node", "python", "python3",
  "pnpm", "yarn", "tsc", "jest", "vitest", "eslint", "prettier",
];

/** Jeitos conhecidos de transformar um comando de aparência inocente em perda de trabalho. */
const NUNCA_SOZINHO = [
  /\brm\b/, /\brmdir\b/, /\bdel\b/, /\bformat\b/, /\bmkfs\b/,
  /\bsudo\b/, /\bsu\b/, /\bchmod\b/, /\bchown\b/, /\bicacls\b/,
  /\bgit\s+(reset|checkout|clean|push|rebase|revert|filter-branch)\b/,
  /\bshutdown\b/, /\breboot\b/, /\bkill\b/, /\btaskkill\b/,
  /\bdd\b/, /\bcurl\b.*\|/, /\bwget\b.*\|/, /\biwr\b.*\|/,
  /\bnpm\s+publish\b/, /\bdocker\b/, /\bsystemctl\b/,
];

/** Encadeamento e redirecionamento. É esta regra que faz as outras duas valerem alguma coisa:
 *  `ls && rm -rf .` começa com um comando liberado. */
const ENCADEIA = /[;&|><`$(){}]|\n/;

export function avaliarComando(comando, permitidos = PERMITIDOS_PADRAO) {
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
    return alvo === prefixo || alvo.startsWith(prefixo + " ");
  });

  return casou ? { liberado: true } : { liberado: false, motivo: "não está na lista de comandos liberados" };
}
