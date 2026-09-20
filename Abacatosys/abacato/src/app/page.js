import { redirect } from "next/navigation";

/** A raiz não tem tela própria: quem chega já passou pelo portão, então o lugar dele é a lista
 *  de quadros. Uma home vazia seria um clique a mais em toda visita. */
export default function Raiz() {
  redirect("/quadros");
}
