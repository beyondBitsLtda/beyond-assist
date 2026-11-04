import { redirect } from "next/navigation";

/** As ilhas moram no Reino agora: as Grandes Expedições (03/11/2026: "não um modo à parte"). O endereço antigo leva para lá. */
export default function Ilhas() {
  redirect("/reino#grandes-expedicoes");
}
