import { supabase } from "@/lib/supabase.js";

/**
 * Configuração que se muda por botão, e não por deploy.
 *
 * Mora numa tabela (`lisa_config`) e não em variável de ambiente por um motivo concreto: a
 * Lisa roda em DOIS lugares — o Worker da Cloudflare e o servidor de casa — e os dois falam
 * com este mesmo Postgres. Uma variável de ambiente precisaria ser mudada nos dois, na mão, e
 * o dia em que elas discordassem seria difícil de perceber: cada servidor estaria "certo"
 * olhando só para si, e a Lisa responderia uma coisa em casa e outra na rua.
 */

// Cache curtíssimo. Esta configuração é lida em quase toda requisição de quadro, e sem cache
// seria uma ida ao banco de casa antes de cada uma — 100ms de atraso para ler um texto que
// muda uma vez por mês. Cinco segundos é curto o bastante para o interruptor parecer
// instantâneo e longo o bastante para tirar o banco do caminho.
const VALIDADE_MS = 5000;
let cache = null; // { em: number, valores: Map }

// A última leitura deu certo? O recuo silencioso abaixo é o comportamento certo em
// produção — servir a configuração de dez segundos atrás é melhor que derrubar a tela — mas
// ele também esconde uma queda total do banco atrás de um "está no trello" perfeitamente
// normal. Quem precisa saber a diferença (um diagnóstico, um teste) pergunta aqui.
let ultimaLeituraDeuCerto = false;

async function carregar() {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.valores;

  const { data, error } = await supabase.from("lisa_config").select("chave, valor");
  if (error) {
    ultimaLeituraDeuCerto = false;
    // Banco fora do ar, ou a tabela ainda não existe num deploy antigo. Devolver o cache
    // velho é melhor que derrubar a tela: a configuração de dez segundos atrás está muito
    // mais perto da verdade que um erro.
    if (cache) return cache.valores;
    return new Map();
  }

  const valores = new Map((data || []).map((l) => [l.chave, l.valor]));
  cache = { em: Date.now(), valores };
  ultimaLeituraDeuCerto = true;
  return valores;
}

/** A configuração foi lida de verdade, ou o que está valendo é o padrão de emergência?
 *  Um sistema que responde "trello" porque está configurado assim e um que responde "trello"
 *  porque o banco caiu são coisas muito diferentes, e daqui de fora pareciam iguais. */
export async function configFoiLida() {
  await carregar();
  return ultimaLeituraDeuCerto;
}

export async function lerConfig(chave, padrao = null) {
  return (await carregar()).get(chave) ?? padrao;
}

export async function gravarConfig(chave, valor, quem = null) {
  const { error } = await supabase
    .from("lisa_config")
    .upsert({ chave, valor, atualizado_em: new Date().toISOString(), atualizado_por: quem }, { onConflict: "chave" });
  if (error) throw new Error(error.message);
  // Invalida na hora: sem isto, o botão pareceria não ter funcionado pelos próximos cinco
  // segundos — tempo mais que suficiente para alguém clicar de novo achando que falhou.
  cache = null;
}

// ---------------------------------------------------------------- fonte dos quadros

export const FONTES_DE_QUADRO = ["trello", "abacato"];

/**
 * De onde vêm as tarefas: do Trello ou do Abacato.
 *
 * Qualquer valor estranho cai em "trello", que é onde os dados estavam quando isto foi
 * escrito. O padrão de uma configuração quebrada tem de ser o comportamento antigo — não o
 * novo, e muito menos um erro.
 */
export async function fonteDosQuadros() {
  const valor = await lerConfig("fonte_dos_quadros", "trello");
  return FONTES_DE_QUADRO.includes(valor) ? valor : "trello";
}
