"use client";

/**
 * Os gráficos do painel, desenhados à mão.
 *
 * Sem biblioteca de gráficos, e é escolha. As três formas de que este painel precisa — barra
 * horizontal, rosca e barra por dia — cabem em CSS e num SVG curto. Uma biblioteca traria
 * centenas de kilobytes, um tema próprio para brigar com o nosso, e cores fixas que ignoram o
 * modo escuro. O que se ganharia é o que não usamos: zoom, animação, tooltip flutuante.
 *
 * As cores saem dos tokens do design system. É por isso que o painel inteiro troca de tema
 * junto com o resto sem nenhuma regra a mais.
 */

/** Uma barra horizontal com rótulo e número. A forma mais legível de comparar poucas coisas. */
export function Barras({ itens, cor = "var(--abacato-verde)", vazio = "nada por aqui" }) {
  if (!itens?.length) return <p className="abacato-dica">{vazio}</p>;
  // A escala é o MAIOR item, não a soma: comparar alturas entre si é a pergunta, e com a soma
  // um item de 60% e outro de 30% viram duas barrinhas quase iguais no canto.
  const teto = Math.max(...itens.map((i) => i.total), 1);

  return (
    <div className="abacato-barras">
      {itens.map((i) => (
        <div key={i.id ?? i.nome} className="abacato-barra">
          <span className="abacato-barra__rotulo" title={i.nome}>{i.nome}</span>
          <span className="abacato-barra__trilho">
            <span
              className="abacato-barra__preenchida"
              style={{ width: `${Math.max(2, (i.total / teto) * 100)}%`, background: i.cor || cor }}
            />
            {/* Os atrasados aparecem DENTRO da barra, em vermelho, e não numa barra separada:
                eles são um pedaço daquele total, não outra coisa. */}
            {i.atrasados > 0 && (
              <span
                className="abacato-barra__atraso"
                style={{ width: `${Math.max(2, (i.atrasados / teto) * 100)}%` }}
                title={`${i.atrasados} atrasado(s)`}
              />
            )}
          </span>
          <span className="abacato-barra__numero">{i.total}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A rosca do andamento.
 *
 * SVG, e não uma biblioteca: é um círculo com o traço pela metade. O número no meio é o que
 * quase todo mundo lê — a rosca serve para dizer, de relance, se está perto do fim ou não.
 */
export function Rosca({ pct, rotulo }) {
  const raio = 52;
  const volta = 2 * Math.PI * raio;
  const preenchido = (Math.min(100, Math.max(0, pct)) / 100) * volta;

  return (
    <div className="abacato-rosca">
      <svg viewBox="0 0 128 128" role="img" aria-label={`${pct}% ${rotulo}`}>
        <circle cx="64" cy="64" r={raio} className="abacato-rosca__trilho" />
        <circle
          cx="64" cy="64" r={raio}
          className="abacato-rosca__arco"
          strokeDasharray={`${preenchido} ${volta}`}
          // Começa no topo, e não à direita: um progresso que nasce às 3 horas parece torto.
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="abacato-rosca__centro">
        <strong>{pct}%</strong>
        <span>{rotulo}</span>
      </div>
    </div>
  );
}

/** As entregas dos próximos dias, uma coluna por dia. O primeiro balde junta tudo que venceu. */
export function Agenda({ baldes }) {
  const teto = Math.max(...baldes.map((b) => b.total), 1);
  const hoje = new Date();

  return (
    <div className="abacato-agenda">
      {baldes.map((b, i) => {
        const dia = b.dia ? new Date(`${b.dia}T12:00:00`) : null;
        const rotulo = b.rotulo || (dia ? String(dia.getDate()) : "");
        // Fim de semana marcado: uma barra alta num sábado quer dizer outra coisa.
        const fimDeSemana = dia && (dia.getDay() === 0 || dia.getDay() === 6);
        const titulo = b.dia
          ? `${dia.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}: ${b.total}`
          : `Já venceram: ${b.total}`;

        return (
          <div key={b.dia || "atrasado"} className="abacato-agenda__dia" title={titulo}>
            <span className="abacato-agenda__coluna">
              <span
                className={`abacato-agenda__barra${i === 0 ? " abacato-agenda__barra--atraso" : ""}`}
                style={{ height: `${b.total ? Math.max(6, (b.total / teto) * 100) : 0}%` }}
              />
            </span>
            <span className="abacato-agenda__numero">{b.total || ""}</span>
            <span className={`abacato-agenda__rotulo${fimDeSemana ? " abacato-agenda__rotulo--fds" : ""}`}>
              {i === 0 ? "vencidos" : rotulo}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** As contagens por estado de prazo, em pílulas. É o que se lê primeiro. */
export function Pilulas({ porEstado }) {
  const linhas = [
    { chave: "atrasado", rotulo: "atrasados", classe: "abacato-pilula--alerta" },
    { chave: "hoje", rotulo: "para hoje", classe: "abacato-pilula--atencao" },
    { chave: "proximo", rotulo: "nos próximos dias", classe: "" },
    { chave: "no-prazo", rotulo: "no prazo", classe: "" },
    { chave: "sem-prazo", rotulo: "sem prazo", classe: "" },
    { chave: "concluido", rotulo: "concluídos", classe: "abacato-pilula--ok" },
  ];
  return (
    <div className="abacato-pilulas">
      {linhas.map((l) => (
        // O zero FICA na tela, apagado. Sumir com ele faria a lista mudar de tamanho a cada
        // atualização, e "nenhum atrasado" é justamente a informação que se quer ver.
        <div key={l.chave} className={`abacato-pilula ${l.classe}${porEstado[l.chave] ? "" : " abacato-pilula--zero"}`}>
          <strong>{porEstado[l.chave]}</strong>
          <span>{l.rotulo}</span>
        </div>
      ))}
    </div>
  );
}
