import fs from "fs";
import path from "path";

// persona.md fica na raiz do repo (não em src/) — de propósito, pra ser fácil de editar sem
// mexer em código. Lido em runtime (não import estático) pra pegar mudanças em novos deploys
// sem precisar tocar em nenhum .js. Ver next.config.js (outputFileTracingIncludes) — sem
// aquilo, a Vercel não inclui esse arquivo no bundle da função e isso falharia em produção.
let _cached = null;

export function getPersonaText() {
  if (_cached !== null) return _cached;
  try {
    _cached = fs.readFileSync(path.join(process.cwd(), "persona.md"), "utf8");
  } catch {
    _cached = ""; // sem persona.md — modo persona simplesmente não teria efeito
  }
  return _cached;
}
