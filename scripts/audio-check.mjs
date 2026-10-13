// O áudio do TTS: só as amostras chegam ao alto-falante (o chiado de 13/10/2026).
// Roda sem rede: monta WAVs como os que o Gemini manda e confere o que sai de pcmDoGemini.
import { pcmDoGemini } from "../src/lib/audioDoGemini.js";

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

function wav({ amostras, taxa = 24000, depois = [], tamanhoDoData = null }) {
  const pcm = new Uint8Array(amostras.length * 2);
  const dv = new DataView(pcm.buffer);
  amostras.forEach((a, i) => dv.setInt16(i * 2, a, true));
  const blocos = [];
  const bloco = (id, conteudo) => {
    const cab = new Uint8Array(8);
    for (let i = 0; i < 4; i++) cab[i] = id.charCodeAt(i);
    new DataView(cab.buffer).setUint32(4, id === "data" && tamanhoDoData != null ? tamanhoDoData : conteudo.length, true);
    blocos.push(cab, conteudo);
    if (conteudo.length % 2) blocos.push(new Uint8Array(1));
  };
  const fmt = new Uint8Array(16);
  const f = new DataView(fmt.buffer);
  f.setUint16(0, 1, true); f.setUint16(2, 1, true); f.setUint32(4, taxa, true);
  f.setUint32(8, taxa * 2, true); f.setUint16(12, 2, true); f.setUint16(14, 16, true);
  bloco("fmt ", fmt);
  bloco("data", pcm);
  for (const [id, n] of depois) bloco(id, new Uint8Array(n).fill(0x7f));
  const corpo = blocos.reduce((s, b) => s + b.length, 0);
  const saida = new Uint8Array(12 + corpo);
  saida.set([82, 73, 70, 70], 0); new DataView(saida.buffer).setUint32(4, 4 + corpo, true); saida.set([87, 65, 86, 69], 8);
  let o = 12; for (const b of blocos) { saida.set(b, o); o += b.length; }
  return { arquivo: saida, pcm };
}
const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

console.log("\nO que vai para o alto-falante\n");

const amostras = Array.from({ length: 1000 }, (_, i) => Math.round(Math.sin(i / 10) * 8000));
let caso = wav({ amostras, depois: [["C2PA", 6062]] });
let r = pcmDoGemini(caso.arquivo, "audio/wav");
conferir("WAV do 3.8-flash-tts: sai SÓ o bloco data (sem cabeçalho nem C2PA)", iguais(r.pcm, caso.pcm), `${r.pcm.length} de ${caso.arquivo.length} bytes`);
conferir("taxa, canais e bits vêm do fmt", r.sampleRate === 24000 && r.canais === 1 && r.bits === 16);

caso = wav({ amostras, taxa: 22050, depois: [["LIST", 31], ["C2PA", 100]] });
r = pcmDoGemini(caso.arquivo, "audio/wav");
conferir("blocos ímpares e vários metadados depois do data ficam de fora", iguais(r.pcm, caso.pcm) && r.sampleRate === 22050);

caso = wav({ amostras, tamanhoDoData: 0xffffffff });
r = pcmDoGemini(caso.arquivo, "audio/wav");
conferir("data com tamanho indefinido vai até o fim", iguais(r.pcm, caso.pcm));

const cru = new Uint8Array([1, 2, 3, 4, 5, 6]);
r = pcmDoGemini(cru, "audio/l16; rate=24000; channels=1");
conferir("PCM cru do 3.1-tts-preview passa como está", iguais(r.pcm, cru) && r.sampleRate === 24000);

r = pcmDoGemini(new Uint8Array([1, 2, 3, 4, 5]), "audio/L16;codec=pcm;rate=16000");
conferir("byte solto no fim é cortado (meia amostra estala)", r.pcm.length === 4 && r.sampleRate === 16000);

const mal = wav({ amostras: [1, 2] }).arquivo.slice(0, 30);
let lancou = false;
try { pcmDoGemini(mal, "audio/wav"); } catch { lancou = true; }
conferir("WAV sem bloco data é erro, não chiado", lancou);

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
