/** @type {import("next").NextConfig} */
const nextConfig = {
  // Sem `next/image`, pelo mesmo motivo do Abacato: não há imagem para otimizar, e ligar a
  // otimização exigiria configuração extra no Worker sem nada em troca.
  reactStrictMode: true,
};
export default nextConfig;
