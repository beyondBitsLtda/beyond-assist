/** @type {import('next').NextConfig} */
const nextConfig = {
  // As variáveis SECRETAS (service_role, chaves) só existem no servidor.
  // Nunca prefixe com NEXT_PUBLIC_ — isso as exporia no navegador.

  // persona.md fica na raiz do repo (fora de src/), lido em runtime por src/lib/persona.js
  // (fs.readFileSync) — sem isso, a Vercel não inclui esse arquivo no bundle da função e a
  // leitura falharia em produção mesmo funcionando local. Mesma lógica pros arquivos de
  // contexto pessoal (contexto/*.md — ver src/lib/context.js); a planilha .xlsx da Delp fica
  // de fora de propósito (é gitignored — nem chega no build da Vercel; ver src/lib/delpTasks.js).
  outputFileTracingIncludes: {
    "/api/**/*": ["./persona.md", "./contexto/*.md"],
  },
};
export default nextConfig;
