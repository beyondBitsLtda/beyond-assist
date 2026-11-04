import { redirect } from "next/navigation";

/** A Forja mora no Reino agora (03/11/2026: "não um modo à parte"). O endereço antigo leva para lá. */
export default function Forja() {
  redirect("/reino#forja");
}
