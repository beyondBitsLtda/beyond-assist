// O título é o que identifica ESTA janela na barra de tarefas quando ela está separada do app.
// Precisa vir daqui (layout de servidor): o metadata do Next é aplicado depois da hidratação e
// sobrescreveria um document.title escrito no cliente.
export const metadata = { title: "Mundo da Lisa" };

export default function MundoLayout({ children }) {
  return children;
}
