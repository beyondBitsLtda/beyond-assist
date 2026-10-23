"use client";

// O MODO DE TESTE (23/10/2026): botões para testar o Reino sem esperar — moedas, combustível,
// veículos, construções, exército, minas e operários. Liberado para todos por enquanto; cada
// botão mexe só no reino de quem aperta. As moedas de teste ficam marcadas e saem com "Tirar as
// moedas de teste".

const ACOES = [
  { id: "moedas", emoji: "💰", titulo: "+1.000 moedas", texto: "para testar compras, a bolsa, o aluguel…" },
  { id: "tanques", emoji: "⛽", titulo: "Encher os tanques", texto: "3 expedições de novo em cada veículo" },
  { id: "veiculos", emoji: "🚀", titulo: "Todos os veículos", texto: "Submarino, Dirigível, Tanque e Nave" },
  { id: "construcoes", emoji: "🏰", titulo: "Tudo no máximo", texto: "construções e Neuro no nível máximo (libera todas as expedições)" },
  { id: "exercito", emoji: "⚔️", titulo: "Exército completo", texto: "exército e defesa do tamanho do Quartel e da Torre" },
  { id: "minas", emoji: "⏩", titulo: "Adiantar as minas", texto: "+24 h de trabalho: ouro, diamantes e moedas para coletar" },
  { id: "operarios", emoji: "👷", titulo: "Mina de Ouro lotada", texto: "operários em todas as vagas" },
  { id: "limpar", emoji: "🧹", titulo: "Tirar as moedas de teste", texto: "remove todas as moedas que vieram daqui" },
];

export default function ModoDeTeste({ ocupado, aoAgir }) {
  return (
    <div className="rn-teste">
      <p className="rn-teste__aviso">
        🧪 <strong>Modo de teste</strong> — liberado para todos por enquanto. Cada botão mexe só no <strong>seu</strong> reino. As moedas de teste ficam marcadas e podem ser retiradas no último botão.
      </p>
      <div className="rn-teste__grade">
        {ACOES.map((a) => (
          <button key={a.id} type="button" className={`rn-teste__botao${a.id === "limpar" ? " rn-teste__botao--limpar" : ""}`} disabled={Boolean(ocupado)} onClick={() => aoAgir(a.id)}>
            <span className="rn-teste__emoji" aria-hidden="true">{a.emoji}</span>
            <span><strong>{ocupado === `teste:${a.id}` ? "Um instante…" : a.titulo}</strong><small>{a.texto}</small></span>
          </button>
        ))}
      </div>
      <p className="rn-teste__dica">Para a Bolsa: abra o pregão — lá o modo de teste deixa ver as cotações em qualquer hora do dia e pedir à Lisa uma prévia do pregão de amanhã.</p>
    </div>
  );
}
