/** @type {import('next').NextConfig} */
const nextConfig = {
  // As variáveis SECRETAS (service_role, chaves) só existem no servidor.
  // Nunca prefixe com NEXT_PUBLIC_ — isso as exporia no navegador.

  // persona.md fica na raiz do repo (fora de src/), lido em runtime por src/lib/persona.js
  // (fs.readFileSync) — sem isso, a Vercel não inclui esse arquivo no bundle da função e a
  // leitura falharia em produção mesmo funcionando local.
  outputFileTracingIncludes: {
    "/api/**/*": ["./persona.md"],
  },
};
export default nextConfig;
