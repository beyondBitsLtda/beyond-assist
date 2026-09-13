/** @type {import('next').NextConfig} */
const nextConfig = {
  // As variáveis SECRETAS (service_role, chaves) só existem no servidor.
  // Nunca prefixe com NEXT_PUBLIC_ — isso as exporia no navegador.

  // persona.md, contexto/*.md e radio/playlist.txt são CONTEÚDO editável fora do código. Eles
  // entram no bundle como texto em tempo de BUILD, em vez de serem lidos do disco em runtime.
  //
  // A leitura em runtime (fs) funcionava na Vercel, mas o Edge runtime do Cloudflare não tem
  // sistema de arquivos — e falhava em SILÊNCIO: os três arquivos tratavam o erro devolvendo
  // string vazia, então a Lisa subiria sem personalidade, sem contexto pessoal e com a playlist
  // vazia, sem nenhum erro no log. Editar esses arquivos continua bastando; quem os lê agora é
  // o build. (O `outputFileTracingIncludes` que existia aqui saiu junto: ele mandava a Vercel
  // copiar esses arquivos pro bundle da função, e isso não é mais necessário.)
  webpack(config) {
    config.module.rules.push({ test: /\.(md|txt)$/, type: "asset/source" });
    return config;
  },
};
export default nextConfig;
