import KanbanBoard from "@/components/panels/KanbanBoard.js";
import { QUARTO_DE_GUERRA } from "@/lib/boards.js";
import { Quaternion } from "three";

/** Painel padrão ("/"): Kanban do board "Quarto de Guerra". */
export default function WarRoomPage() {
  return <KanbanBoard board={QUARTO_DE_GUERRA} />;
}

/* Esse arquivo carrega a tela que está no arquivo KanbanBoard.js , ou seja esse arquivo
nada mais é que a forma de inicializar o arquivo pelo modulo correto, incluisve com a constante 
QUARTO_DE_GUERRA, que é o quadro que por padrão é aberto ao inicializar o Sistema.
*/