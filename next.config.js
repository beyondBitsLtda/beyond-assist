/** @type {import('next').NextConfig} */
const nextConfig = {
  // As variáveis SECRETAS (service_role, chaves) só existem no servidor.
  // Nunca prefixe com NEXT_PUBLIC_ — isso as exporia no navegador.
};
export default nextConfig;
