/** @type {import("next").NextConfig} */
const nextConfig = {
  // O Abacato nasce sem `next/image`: as unicas imagens sao a logo e os papeis de parede dos
  // quadros, que vem do proprio servidor. Ligar a otimizacao exigiria configuracao extra no
  // Worker sem nada em troca.
  reactStrictMode: true,
};
export default nextConfig;
