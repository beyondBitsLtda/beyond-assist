// O título é o que identifica ESTA janela na barra de tarefas quando ela está separada do app.
// Precisa vir daqui (layout de servidor) e não de um document.title no efeito: o metadata do
// Next é aplicado depois da hidratação e sobrescreveria o que o cliente tivesse escrito.
export const metadata = { title: "Pair Programming · Lisa" };

export default function PairLayout({ children }) {
  return children;
}
