// Uso: npm run deploy-map
//
// Confere a leitura do quadro "Map of Deploy" e a matemática de disponibilidade
// (src/lib/mapOfDeploy.js) sem Trello e sem Supabase. Importa o módulo direto — é o mesmo que
// a rota e o painel usam.
//
// O que isto protege:
// - a CONVENÇÃO do quadro (coluna = servidor, etiqueta = conta, descrição = link). Se alguém
//   mudar o formato da descrição, o painel fica mudo sem erro nenhum aparecer na tela;
// - a diferença entre FALHA e QUEDA. Uma queda de três horas com checagem de 5 em 5 minutos são
//   36 falhas e uma queda só — trocar um pelo outro faz o painel responder a pergunta errada.
import {
  NO_AR, SEM_LINK, agruparPorServidor, classificar, desde, extrairUrl,
  normalizarApps, resumo, resumoGeral,
} from "../src/lib/mapOfDeploy.js";

let fails = 0;
const ok = (nome, cond, extra = "") => {
  console.log(`${cond ? "PASSA" : "FALHA"}  ${nome}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

// --- o link sai da descrição, escrito de qualquer jeito ---
ok("URL completa", extrairUrl("https://crm.exemplo.com") === "https://crm.exemplo.com");
ok("URL no meio de um texto", extrairUrl("no ar em https://app.vercel.app desde ontem") === "https://app.vercel.app");
ok("link markdown", extrairUrl("[abrir](https://site.com/painel)") === "https://site.com/painel");
ok("ponto final não entra na URL", extrairUrl("acesse https://site.com.") === "https://site.com");
ok("domínio solto ganha https", extrairUrl("meuapp.vercel.app") === "https://meuapp.vercel.app");
ok("domínio com caminho", extrairUrl("exemplo.com.br/admin") === "https://exemplo.com.br/admin");
ok("descrição sem link devolve nada", extrairUrl("hospedado na conta antiga") === null);
ok("nome de arquivo não vira link", extrairUrl("ver config.json") === null);
ok("descrição vazia não quebra", extrairUrl(null) === null && extrairUrl("") === null);

// --- cards viram aplicações ---
const cards = [
  { id: "a1", name: "CRM amparar", list: "CloudFlare", labels: "beyondbitsltda", desc: "https://crm.amparar.com" },
  { id: "a2", name: "Portifolio Alan", list: "Gitpages", labels: "beyondbitsltda", desc: "alan.github.io" },
  { id: "a3", name: "Site mundo feliz", list: "Gitpages", labels: "beyondbitsltda", desc: "" },
  { id: "a4", name: "Controle de teste", list: "Vercel", labels: [{ name: "conta pessoal" }], desc: "https://controle.vercel.app" },
];
const apps = normalizarApps(cards);
ok("todo card vira aplicação", apps.length === 4);
ok("a coluna vira servidor", apps[0].servidor === "CloudFlare" && apps[1].servidor === "Gitpages");
ok("a etiqueta vira conta", apps[0].conta === "beyondbitsltda" && apps[3].conta === "conta pessoal");
ok("a descrição vira link", apps[0].url === "https://crm.amparar.com" && apps[1].url === "https://alan.github.io");
// Um card sem link some do radar sem nenhum aviso se for descartado — e some justamente o card
// que precisa ser arrumado no quadro.
ok("card sem link continua na lista, marcado", apps[2].url === null && apps[2].problema === SEM_LINK);
ok("card sem id é descartado", normalizarApps([{ name: "solto" }]).length === 0);

const grupos = agruparPorServidor(apps, ["CloudFlare", "Gitpages", "Vercel"]);
ok("um grupo por servidor", grupos.length === 3);
ok("a ordem das colunas do quadro é respeitada", grupos.map((g) => g.servidor).join(">") === "CloudFlare>Gitpages>Vercel");
ok("servidor fora da ordem conhecida vai pro fim",
  agruparPorServidor(apps, ["Vercel"]).map((g) => g.servidor)[0] === "Vercel");

// --- o que cada resposta HTTP significa ---
ok("200 é estar no ar", classificar({ status: 200 }) === NO_AR);
ok("301 é estar no ar", classificar({ status: 301 }) === NO_AR);
// 404 na raiz de um deploy não é o site funcionando: é o deploy quebrado respondendo
ok("404 é erro, não 'no ar'", classificar({ status: 404 }) === "erro");
ok("500 é erro", classificar({ status: 500 }) === "erro");
ok("sem resposta é estar fora", classificar({ erro: "timeout" }) === "fora" && classificar({}) === "fora");

// --- disponibilidade ---
const min = 60000;
const t0 = Date.parse("2026-09-13T12:00:00Z");
const serie = (padrao) => padrao.split("").map((c, i) => ({
  checked_at: new Date(t0 + i * 5 * min).toISOString(),
  status: c === "o" ? 200 : c === "e" ? 500 : null,
  erro: c === "x" ? "timeout" : null,
  ms: c === "o" ? 120 + i : null,
}));

const vazio = resumo([]);
ok("sem histórico, o estado é desconhecido", vazio.estado === "desconhecido" && vazio.uptime === null);

const r = resumo(serie("ooxxxxooooxoo"));
ok("uptime conta só o que estava no ar", Math.abs(r.uptime - 8 / 13) < 1e-9, `${(r.uptime * 100).toFixed(0)}%`);
ok("falhas contam cada checagem ruim", r.falhas === 5, `${r.falhas}`);
// é isto que responde "quantas vezes ficou indisponível": as cinco falhas aconteceram em dois
// episódios, e é o número de episódios que a pergunta quer
ok("quedas contam episódios, não checagens", r.quedas === 2, `${r.quedas} quedas para ${r.falhas} falhas`);
ok("uma sequência de falhas seguidas é uma queda só", resumo(serie("ooxxxxxxxxo")).quedas === 1);
ok("o estado é o da última checagem", r.estado === NO_AR);
ok("guarda quando a última queda começou", r.ultimaQueda === t0 + 10 * 5 * min);
ok("o tempo médio de resposta ignora as falhas", r.msMedio > 0 && r.msMedio < 200, `${r.msMedio}ms`);

const caiuAgora = resumo(serie("ooooox"));
ok("caiu na última checagem: estado fora e uma queda", caiuAgora.estado === "fora" && caiuAgora.quedas === 1);
ok("o início do estado atual é a hora da queda", caiuAgora.desde === t0 + 5 * 5 * min);
ok("sempre no ar não registra queda", resumo(serie("ooooo")).quedas === 0);
ok("sempre fora não registra queda (nunca esteve no ar)", resumo(serie("xxxxx")).quedas === 0);
ok("checagens fora de ordem são ordenadas antes da conta",
  resumo([...serie("ooxx")].reverse()).estado === "fora");

// --- o cabeçalho do painel ---
const comResumo = apps.map((a, i) => ({ ...a, resumo: resumo(serie(["ooooo", "ooxxo", "", "xxxxx"][i])) }));
const geral = resumoGeral(comResumo);
ok("o geral separa quem não tem link", geral.aplicacoes === 4 && geral.semLink === 1);
ok("o geral conta quem está no ar e quem está fora", geral.noAr === 2 && geral.fora === 1, JSON.stringify({ noAr: geral.noAr, fora: geral.fora }));
ok("o geral soma as quedas de todas", geral.quedas === 1, `${geral.quedas}`);
ok("o uptime geral é a média de quem tem histórico", geral.uptime > 0 && geral.uptime < 1, `${(geral.uptime * 100).toFixed(0)}%`);

// --- tempo decorrido ---
const agora = Date.parse("2026-09-13T12:00:00Z");
ok("tempo decorrido em minutos", desde(agora - 3 * min, agora) === "há 3 min");
ok("tempo decorrido em horas", desde(agora - 2 * 3600000, agora) === "há 2 h");
ok("tempo decorrido em dias", desde(agora - 4 * 86400000, agora) === "há 4 d");
ok("segundos viram 'agora há pouco'", desde(agora - 5000, agora) === "agora há pouco");
ok("sem data não inventa texto", desde(null) === null);

console.log("\num quadro lido:");
for (const g of grupos) {
  console.log(`  ${g.servidor}`);
  for (const a of g.apps) console.log(`    ${a.nome.padEnd(28)} ${a.conta ?? "—"}  ${a.url ?? "(sem link no card)"}`);
}

console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fails ? 1 : 0);
