// Mede, agora, quanto cada modelo de chat leva para responder em streaming e se o stream
// termina inteiro. Não imprime chaves. Uso: node --env-file=.env scripts/medir-modelos.mjs
import { GoogleGenAI } from "@google/genai";

const chaves = String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
const modelos = (process.argv[2] || "gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite").split(",");
const pergunta = "Explique em quatro parágrafos curtos por que quedas de energia podem corromper bancos de dados.";

for (const modelo of modelos) {
  for (let i = 0; i < 3; i++) {
    const cliente = new GoogleGenAI({ apiKey: chaves[(i * 7 + modelos.indexOf(modelo)) % chaves.length] });
    const t0 = Date.now();
    let primeiro = null, chars = 0;
    try {
      const stream = await cliente.models.generateContentStream({ model: modelo, contents: pergunta });
      for await (const c of stream) { if (c.text) { primeiro ??= Date.now() - t0; chars += c.text.length; } }
      console.log(`${modelo.padEnd(24)} ok     1º pedaço ${primeiro}ms · total ${Date.now() - t0}ms · ${chars} letras`);
    } catch (e) {
      console.log(`${modelo.padEnd(24)} FALHOU depois de ${Date.now() - t0}ms (${chars} letras já chegadas): ${String(e?.message || e).slice(0, 140)}`);
    }
  }
}
