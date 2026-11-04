// Uma exportação do Trello, sintética, com tudo que costuma dar errado numa de verdade.
//
// Fica num arquivo próprio porque dois scripts a usam: o `trello-check`, que confere a leitura
// sem tocar no banco, e o `importar-check`, que confere a gravação. Duas cópias do mesmo
// exemplo divergem, e aí os dois passam enquanto o sistema quebra no meio.
//
// O `id` do quadro muda a cada execução. Sem isso, a segunda rodada do teste encontraria o
// quadro que a primeira importou e testaria "reimportação" quando queria testar "importação".

export function exportacaoDeExemplo(sufixo = Date.now().toString(36)) {
  const id = (base) => `${base}-${sufixo}`;
  return {
    id: id("quadro"),
    name: `Obra — Delp Engenharia [teste ${sufixo}]`,
    desc: "Acompanhamento da obra.",
    prefs: { background: "blue", backgroundColor: null },
    labels: [
      { id: id("lab1"), name: "Urgente", color: "red" },
      { id: id("lab2"), name: "Cliente", color: "blue_dark" },
      { id: id("lab3"), name: "", color: "sky" },
      { id: id("lab4"), name: "Inventada", color: "arco-iris" },
    ],
    lists: [
      { id: id("li1"), name: "A fazer", pos: 65535, closed: false },
      { id: id("li2"), name: "Fazendo", pos: 131071, closed: false },
      { id: id("li3"), name: "Arquivada de 2024", pos: 196607, closed: true },
    ],
    members: [
      { id: id("mem1"), fullName: "Ana Souza", username: "anasouza" },
      { id: id("mem2"), fullName: "Carlos Lima", username: "clima" },
    ],
    cards: [
      {
        id: id("c1"), name: "Renovar ART", desc: "Vence este mês.", pos: 65535, closed: false, idList: id("li1"),
        due: "2026-10-15T17:00:00.000Z", start: "2026-10-01T12:00:00.000Z", dueComplete: false,
        idLabels: [id("lab1"), id("lab2")], idMembers: [id("mem1")],
        cover: { color: "orange" },
        attachments: [
          { url: "https://exemplo.com.br/planta.pdf", name: "Planta", isUpload: false },
          { url: "https://trello.com/1/cards/c1/attachments/x/download/foto.jpg", name: "Foto", isUpload: true },
        ],
      },
      {
        id: id("c2"), name: "Medição de setembro", desc: "", pos: 131071, closed: false, idList: id("li1"),
        due: "2026-09-30T17:00:00.000Z", start: null, dueComplete: true,
        idLabels: [], idMembers: [id("mem1"), id("mem2")], cover: null, attachments: [],
      },
      {
        id: id("c3"), name: "Levantamento topográfico", desc: null, pos: 65535, closed: false, idList: id("li2"),
        due: null, start: null, dueComplete: false, idLabels: [id("lab3")], idMembers: [], cover: null, attachments: [],
      },
      {
        id: id("c4"), name: "Card velho", desc: "", pos: 65535, closed: true, idList: id("li3"),
        due: null, start: null, dueComplete: false, idLabels: [], idMembers: [], cover: null, attachments: [],
      },
      {
        id: id("c5"), name: "Órfão", desc: "", pos: 1, closed: false, idList: "LISTA-QUE-NAO-VEIO",
        due: null, start: null, dueComplete: false, idLabels: [], idMembers: [], cover: null, attachments: [],
      },
      {
        id: id("c6"), name: "  ", desc: "", pos: 2, closed: false, idList: id("li2"),
        due: "data-que-nao-e-data", start: null, dueComplete: false,
        idLabels: [], idMembers: [], cover: null, attachments: [],
      },
    ],
    checklists: [
      {
        id: id("ck1"), idCard: id("c1"), name: "Documentos", pos: 16384,
        checkItems: [
          { id: id("it2"), name: "Assinatura do responsável", state: "incomplete", pos: 32768 },
          { id: id("it1"), name: "Cópia do contrato", state: "complete", pos: 16384 },
          { id: id("it3"), name: "   ", state: "incomplete", pos: 49152 },
        ],
      },
      { id: id("ck2"), idCard: id("c1"), name: "", pos: 8192, checkItems: [] },
    ],
    actions: [{ id: "a1", type: "updateCard" }],
  };
}
