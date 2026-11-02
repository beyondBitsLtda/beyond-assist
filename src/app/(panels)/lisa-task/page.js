// A Lisa Task (01/11/2026: "use o Abacato já existente, só passa um modo gráfico nele e limite o
// acesso a não deixar usar a parte de documentos"). Ela é o Abacato: a conta do tipo "Lisa Task"
// abre com o nome e o visual da Lisa e sem documentos (Abacatosys/abacato/src/dominio/planos.js).
// Esta rota só leva até lá — o menu a abre em outra aba. O `?visual=lisa` faz até a tela de entrar
// do Abacato sair com a cara da Lisa Task; o login é o do Abacato, separado do da Lisa.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // o redirecionamento acontece no pedido, com o LISA_TASK_URL de agora

const ENDERECO_DA_LISA_TASK = process.env.LISA_TASK_URL || "https://abacato.beyond.dev.br/?visual=lisa";

export default function LisaTask() {
  redirect(ENDERECO_DA_LISA_TASK);
}
