import { jsonResponse } from "@/lib/http.js";
import { conferirTokenDaExtensao } from "@/lib/lisaCodeAuth.js";
import { avaliarComando } from "@/lib/comandosPermitidos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lisa-code/executar   headers: { "x-lisa-token": "..." }   body: { comando }
 *
 * Roda um comando NO SERVIDOR e devolve a saída. Serve para a Lisa Code rodar testes e builds
 * fora da sua máquina de trabalho: um comando que dê errado estraga o servidor de casa, não o
 * notebook onde você está editando.
 *
 * ISTO NÃO É UM SANDBOX, e a diferença importa. Sandbox é isolamento — contêiner, sistema de
 * arquivos próprio, sem acesso à rede da casa. Aqui é outro RAIO DE ALCANCE: o comando roda
 * como o usuário do iMac, com tudo que ele pode fazer. O ganho é que o iMac é reconstruível em
 * uma tarde e o seu notebook de trabalho não.
 *
 * A lista de permitidos é conferida AQUI DE NOVO, e não só na extensão. Quem chama esta rota é
 * quem tem o token — não necessariamente a extensão. Confiar na checagem do cliente seria
 * confiar em qualquer um que descubra o endereço.
 */
export async function POST(req) {
  try {
    const acesso = conferirTokenDaExtensao(req);
    if (!acesso.ok) return jsonResponse({ ok: false, error: acesso.motivo }, 401);

    // O interruptor mora no servidor, e nasce desligado. Um deploy na Cloudflare nunca deveria
    // aceitar isto — lá não existe terminal, e a variável não estando definida é o que garante
    // que a rota não vire uma porta entreaberta por esquecimento.
    if (process.env.LISA_EXECUCAO_REMOTA !== "1") {
      return jsonResponse({
        ok: false,
        error: "execução remota desligada neste servidor (LISA_EXECUCAO_REMOTA não está em 1)",
      }, 403);
    }

    const { comando } = await req.json().catch(() => ({}));
    const cmd = String(comando || "").trim();
    if (!cmd) return jsonResponse({ ok: false, error: "comando é obrigatório" }, 400);

    const veredito = avaliarComando(cmd);
    if (!veredito.liberado) {
      // Diferente do lado do cliente, aqui NÃO existe "confirmar mesmo assim": não há ninguém
      // olhando a tela do servidor para aprovar. O que não está na lista simplesmente não roda.
      return jsonResponse({ ok: false, error: `comando não liberado para execução remota: ${veredito.motivo}` }, 403);
    }

    const raiz = process.env.LISA_EXECUCAO_RAIZ || process.cwd();
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const rodar = promisify(exec);

    try {
      const { stdout, stderr } = await rodar(cmd, {
        cwd: raiz,
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      });
      const saida = [stdout, stderr].filter(Boolean).join("\n").trim();
      return jsonResponse({ ok: true, onde: "servidor", comando: cmd, saida: saida.slice(0, 20_000) || "(sem saída)" });
    } catch (err) {
      if (err?.killed) {
        return jsonResponse({ ok: true, onde: "servidor", comando: cmd, erro: "passou de 2 minutos e foi encerrado" });
      }
      // Código de saída diferente de zero é RESULTADO, não acidente: um teste que falhou traz
      // exatamente o que a Lisa precisa ler para consertar.
      const saida = [err?.stdout, err?.stderr].filter(Boolean).join("\n").trim();
      return jsonResponse({
        ok: true, onde: "servidor", comando: cmd, falhou: true,
        saida: (saida || String(err?.message || err)).slice(0, 20_000),
      });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
