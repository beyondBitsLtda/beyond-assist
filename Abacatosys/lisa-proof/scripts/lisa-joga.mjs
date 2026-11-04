// A Lisa joga o Proof, rodado na mão (03/11/2026). Quem joga de verdade é o relógio da nuvem: o gatilho de
// horário do Worker chama /api/lisa/rodada a cada 20 minutos (worker-proof.js). A rotina mora em
// src/lib/lisaRotina.js; este script serve para testar ou forçar uma ação.
//
// Uso (na pasta do lisa-proof, com o .env.local, que tem o banco e as chaves do Gemini):
//   npm run lisa-joga                       uma rodada: o que está na vez agora
//   npm run lisa-joga -- --criar-conta      cria a conta dela (uma vez) e sai
//   npm run lisa-joga -- --so=quiz          só uma ação, fora da agenda (curso, mina, teoria, quiz, exercicio,
//                                           projeto, reino, bolsa, caderno, acervo, correio, ilhas, minigame)

import { rodadaDaLisa, criarConta } from "@/lib/lisaRotina.js";

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));

const tarefa = args.has("criar-conta") ? criarConta() : rodadaDaLisa({ so: args.has("so") ? String(args.get("so")) : null, maximo: 20 });
tarefa.then(() => process.exit(0), (e) => { console.error("lisa-joga ERRO:", e?.message || e); process.exit(1); });
