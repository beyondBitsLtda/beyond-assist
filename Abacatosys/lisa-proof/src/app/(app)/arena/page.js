import { redirect } from "next/navigation";

/** A Arena virou o minigame do dia da Prática (03/11/2026: "não um modo à parte"). O endereço antigo leva para lá. */
export default function Arena() {
  redirect("/pratica#minigame");
}
