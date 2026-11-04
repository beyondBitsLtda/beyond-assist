// O jeito de falar com o próprio servidor, a partir do navegador.
//
// Existe para que nenhuma tela precise lembrar de conferir `res.ok` E `dados.ok` — as duas
// coisas, porque um 500 e um `{ ok: false }` com status 200 são falhas diferentes e a tela
// precisa tratar as duas igual. Esquecer a segunda é o erro clássico: a gravação falha, a
// resposta chega, e a tela mostra sucesso.

export async function pedir(url, { metodo = "GET", corpo } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: corpo ? { "content-type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
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

  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.ok === false) throw new Error(dados.error || `falha ${res.status}`);
  return dados;
}

export const obter = (url) => pedir(url);
export const criar = (url, corpo) => pedir(url, { metodo: "POST", corpo });
export const mudar = (url, corpo) => pedir(url, { metodo: "PATCH", corpo });
export const definir = (url, corpo) => pedir(url, { metodo: "PUT", corpo });
export const remover = (url) => pedir(url, { metodo: "DELETE" });
