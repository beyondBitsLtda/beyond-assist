// O jeito de falar com o próprio servidor, a partir do navegador.
//
// Existe para que nenhuma tela precise lembrar de conferir `res.ok` E `dados.ok` — as duas
// coisas, porque um 500 e um `{ ok: false }` com status 200 são falhas diferentes e a tela
// precisa tratar as duas igual. Esquecer a segunda é o erro clássico: a gravação falha, a
// resposta chega, e a tela mostra sucesso.

// Quando o Cloudflare derruba a requisição por passar do limite de CPU do plano gratuito (erro 1102),
// a resposta é um 503 SEM o nosso JSON. É intermitente: a mesma chamada, de novo, costuma passar.
// Leitura (GET) se repete sozinha; escrita só quando quem chama diz que repetir é seguro (`repetir`),
// porque a primeira pode ter gravado antes de cair (31/10/2026).
const ESPERAS_DO_503 = [450, 1200];
const MENSAGEM_DO_503 = "o servidor ficou sem fôlego por um instante (limite do plano gratuito do Cloudflare) — tente de novo";

export async function pedir(url, { metodo = "GET", corpo, repetir = metodo === "GET" } = {}) {
  for (let tentativa = 0; ; tentativa++) {
    const r = await pedirUmaVez(url, { metodo, corpo });
    if (!r.caiuNaPlataforma) return r.dados;
    if (!repetir || tentativa >= ESPERAS_DO_503.length) throw new Error(MENSAGEM_DO_503);
    await new Promise((ok) => setTimeout(ok, ESPERAS_DO_503[tentativa]));
  }
}

async function pedirUmaVez(url, { metodo, corpo }) {
  let res;
  // FormData (arquivos: fotos, áudio) vai como está — o navegador põe o content-type com o separador
  const formulario = typeof FormData !== "undefined" && corpo instanceof FormData;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: corpo && !formulario ? { "content-type": "application/json" } : undefined,
      body: corpo ? (formulario ? corpo : JSON.stringify(corpo)) : undefined,
    });
  } catch {
    // Rede caída, servidor fora, túnel de casa dormindo. Vale uma mensagem própria porque o
    // conserto é outro: não adianta tentar de novo o mesmo clique.
    throw new Error("sem resposta do servidor");
  }

  // 401 é caso à parte: a sessão venceu enquanto a aba estava aberta. Mandar para o login é
  // mais útil que mostrar "não autorizado" numa tela que a pessoa não tem como consertar.
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/entrar?de=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("sessão expirada");
  }

  const dados = await res.json().catch(() => null);
  // 503 sem o nosso JSON: quem caiu foi a plataforma, não a regra do app
  if (res.status === 503 && !dados) return { caiuNaPlataforma: true };
  if (!res.ok || dados?.ok === false) throw new Error(dados?.error || `falha ${res.status}`);
  return { dados: dados || {} };
}

export const obter = (url) => pedir(url);
export const criar = (url, corpo) => pedir(url, { metodo: "POST", corpo });
export const mudar = (url, corpo) => pedir(url, { metodo: "PATCH", corpo });
export const definir = (url, corpo) => pedir(url, { metodo: "PUT", corpo });
export const remover = (url) => pedir(url, { metodo: "DELETE" });
