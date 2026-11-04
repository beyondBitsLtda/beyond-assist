"use client";

import { useParams } from "next/navigation";
import LeitorDePdf from "@/componentes/biblioteca/LeitorDePdf.js";

/** Um livro aberto no leitor (25/10/2026). `?pagina=` abre direto na página (os links do caderno usam). */
export default function Livro() {
  const { id } = useParams();
  return <LeitorDePdf key={id} livroId={id} />;
}
