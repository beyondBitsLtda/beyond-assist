import KanbanBoard from "@/components/panels/KanbanBoard.js";
import { QUARTO_DE_GUERRA } from "@/lib/boards.js";

/** Painel padrão ("/"): Kanban do board "Quarto de Guerra". */
export default function WarRoomPage() {
  return <KanbanBoard board={QUARTO_DE_GUERRA} />;
}
