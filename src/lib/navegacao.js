// Os painéis da Lisa, agrupados — UMA lista para o app inteiro.
//
// Antes havia duas: a barra lateral (18 itens soltos, em caixa alta) e a grade de painéis do
// Assistente no celular, que já tinha divergido dela (uma tinha a Máquina, a outra o Dashboard
// AR). O menu "Painéis" do topo e a lista do celular leem daqui; um painel novo entra num lugar só.

export const GRUPOS_DE_PAINEIS = [
  {
    titulo: "Conversa",
    itens: [
      { href: "/assistant", rotulo: "Assistente" },
      { href: "/visual", rotulo: "Visual da Lisa", detalhe: "Esfera, Lente, Orbe, Plasma ou Anel" },
    ],
  },
  {
    titulo: "Trabalho",
    itens: [
      { href: "/", rotulo: "Quarto de Guerra", detalhe: "Kanban principal" },
      { href: "/tasks", rotulo: "Tarefas" },
      { href: "/boards", rotulo: "Boards" },
      { href: "/dashboard", rotulo: "Dashboard" },
      { href: "/delp-tasks", rotulo: "Tarefas Delp" },
      { href: "/map-of-deploy", rotulo: "Mapa de deploy" },
    ],
  },
  {
    titulo: "Conhecimento",
    itens: [
      { href: "/thoughts", rotulo: "Pensamentos" },
      { href: "/news", rotulo: "Notícias e clima" },
      { href: "/scheduled-announcements", rotulo: "Falas agendadas" },
    ],
  },
  {
    titulo: "Código e testes",
    itens: [
      { href: "/code-repos", rotulo: "Repositórios" },
      { href: "/code-tasks", rotulo: "Tarefas de código" },
      { href: "/arch-docs", rotulo: "Mapa de arquitetura" },
      { href: "/test-mode", rotulo: "Modo de testes" },
      { href: "/sentinel", rotulo: "Sentinela" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/sync-status", rotulo: "Progresso do sync" },
      { href: "/gemini-keys", rotulo: "Chaves de IA" },
      // A tela do iMac vale nos dois lugares: em casa ela é embutida; na nuvem, o painel
      // entrega o endereço próprio que o túnel publica.
      { href: "/maquina", rotulo: "Tela do servidor" },
      { href: "/dashboard/ar", rotulo: "Dashboard AR" },
    ],
  },
];

/** O painel de um caminho, para o topo mostrar onde se está. */
export function painelDe(caminho) {
  for (const g of GRUPOS_DE_PAINEIS) {
    const item = g.itens.find((i) => i.href === caminho);
    if (item) return item;
  }
  return null;
}
