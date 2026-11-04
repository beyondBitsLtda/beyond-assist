// Configuração do adaptador @opennextjs/cloudflare.
//
// Fica no mínimo de propósito. O modelo que vem com o pacote liga um cache incremental em R2 e
// uma referência de serviço a si mesmo, que servem para ISR — páginas revalidadas no servidor.
// A Lisa não tem nenhuma: as 21 páginas dela são estáticas e todo dado vem por fetch do
// navegador. Ligar aquilo exigiria criar um bucket R2 e não mudaria nada aqui.
//
// A otimização de imagem também ficou de fora: o app não usa `next/image` em lugar nenhum.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
