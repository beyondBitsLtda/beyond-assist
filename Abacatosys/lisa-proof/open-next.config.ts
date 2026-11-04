// Adaptador @opennextjs/cloudflare, no mínimo — mesma decisão do Abacato e da Lisa.
//
// Nenhuma página é revalidada no servidor: tudo que muda (pontos, ofensiva, itens marcados)
// vem por fetch do navegador. Cache incremental em R2 não teria o que guardar.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
