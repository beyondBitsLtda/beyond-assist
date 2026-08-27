// As 30 vozes pré-definidas documentadas pela Google pro TTS do Gemini (nome + "característica"
// oficial — a documentação não classifica por gênero). Client-safe (sem nada de servidor) —
// importado tanto pelo seletor de voz (src/app/(panels)/assistant/page.js) quanto por
// src/lib/gemini.js (que faz a chamada de verdade pro TTS).
export const TTS_VOICES = [
  { name: "Zephyr", trait: "Bright" }, { name: "Puck", trait: "Upbeat" },
  { name: "Charon", trait: "Informative" }, { name: "Kore", trait: "Firm" },
  { name: "Fenrir", trait: "Excitable" }, { name: "Leda", trait: "Youthful" },
  { name: "Orus", trait: "Firm" }, { name: "Aoede", trait: "Breezy" },
  { name: "Callirrhoe", trait: "Easy-going" }, { name: "Autonoe", trait: "Bright" },
  { name: "Enceladus", trait: "Breathy" }, { name: "Iapetus", trait: "Clear" },
  { name: "Umbriel", trait: "Easy-going" }, { name: "Algieba", trait: "Smooth" },
  { name: "Despina", trait: "Smooth" }, { name: "Erinome", trait: "Clear" },
  { name: "Algenib", trait: "Gravelly" }, { name: "Rasalgethi", trait: "Informative" },
  { name: "Laomedeia", trait: "Upbeat" }, { name: "Achernar", trait: "Soft" },
  { name: "Alnilam", trait: "Firm" }, { name: "Schedar", trait: "Even" },
  { name: "Gacrux", trait: "Mature" }, { name: "Pulcherrima", trait: "Forward" },
  { name: "Achird", trait: "Friendly" }, { name: "Zubenelgenubi", trait: "Casual" },
  { name: "Vindemiatrix", trait: "Gentle" }, { name: "Sadachbia", trait: "Lively" },
  { name: "Sadaltager", trait: "Knowledgeable" }, { name: "Sulafat", trait: "Warm" },
];
