// Adaptador @opennextjs/cloudflare, no minimo — mesma decisao da Lisa.
//
// O modelo que vem com o pacote liga cache incremental em R2 e uma referencia de servico a si
// mesmo, que servem para paginas revalidadas no servidor. O Abacato nao tem nenhuma: tudo que
// muda vem por fetch do navegador, porque quadro e card mudam a cada segundo e pagina
// revalidada de 60 em 60 segundos mostraria o passado.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
