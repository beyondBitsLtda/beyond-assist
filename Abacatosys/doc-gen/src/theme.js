/* =============================================================================
   theme.js - O estilo do portal gerado.
   -----------------------------------------------------------------------------
   Os tokens sao os do Abacato System: verde #22C55E como cor de acao, superficies
   claras, cantos generosos, sombra baixa. Um portal gerado por esta ferramenta e
   publicado no repositorio de documentos do Abacato deve parecer parte dele, e
   nao um anexo de outro mundo.

   DUAS DECISOES GOVERNAM ESTE ARQUIVO INTEIRO:

   1. O PORTAL PRECISA FUNCIONAR SEM JAVASCRIPT.
      O visor de documentos do Abacato desenha HTML enviado dentro de um
      <iframe sandbox="">, sem nenhuma permissao - o que desliga o script da
      pagina. E a trava certa: ali se desenha codigo que outra pessoa mandou.
      Entao o portal nao pode DEPENDER de script para mostrar nada. Navegacao e
      ancora, secao que abre e <details>, realce de sintaxe ja vem pronto do
      gerador. Com JavaScript (abrindo o arquivo direto no navegador) ele ganha
      filtro e foco no grafo; sem ele, continua inteiro.

   2. O TEMA ESCURO E AUTOMATICO.
      Sem script nao ha botao de tema, entao quem manda e o sistema operacional,
      por prefers-color-scheme. Os dois temas sao desenhados, nao invertidos.
============================================================================= */
'use strict';

function css() {
    return `
:root{
  --dg-verde:#22C55E; --dg-verde-fundo:#10B981; --dg-verde-claro:#D8EBDD;
  --dg-barra:#111814; --dg-barra-2:#17201A;
  --dg-fundo:#F4F6F5; --dg-superficie:#FFFFFF; --dg-superficie-2:#F4F6F5;
  --dg-tinta:#1F2937; --dg-tinta-2:#6B7280; --dg-tinta-3:#9CA3AF;
  --dg-tinta-barra:#FFFFFF; --dg-tinta-barra-2:#9CA3AF;
  --dg-alerta:#EF4444; --dg-alerta-fundo:#FEE2E2;
  --dg-atencao:#F97316; --dg-atencao-fundo:#FFEDD5;
  --dg-info:#3B82F6; --dg-info-fundo:#DBEAFE;
  --dg-linha:rgba(31,41,55,.08); --dg-linha-forte:rgba(31,41,55,.16);
  --dg-raio:16px; --dg-raio-2:24px; --dg-pilula:9999px;
  --dg-sombra:0 4px 20px rgba(0,0,0,.03); --dg-sombra-alta:0 8px 30px rgba(0,0,0,.08);
  --dg-font:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  --dg-mono:ui-monospace,'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;
  --dg-lateral:272px;
  color-scheme:light;
}

/* O tema escuro e desenhado, nao invertido: o verde continua legivel sobre o
   fundo escuro porque o FUNDO e que muda de temperatura, nao a cor de acao. */
@media (prefers-color-scheme: dark){
  :root{
    --dg-fundo:#0D1310; --dg-superficie:#151E19; --dg-superficie-2:#1B2621;
    --dg-barra:#0A0F0C; --dg-barra-2:#111814;
    --dg-tinta:#E8EDEA; --dg-tinta-2:#9BA8A1; --dg-tinta-3:#6B7A73;
    --dg-verde-claro:#1E3A2A;
    --dg-alerta-fundo:#3B1A1A; --dg-atencao-fundo:#3A2416; --dg-info-fundo:#16283F;
    --dg-linha:rgba(232,237,234,.10); --dg-linha-forte:rgba(232,237,234,.20);
    --dg-sombra:0 4px 20px rgba(0,0,0,.35); --dg-sombra-alta:0 8px 30px rgba(0,0,0,.5);
    color-scheme:dark;
  }
}

*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--dg-font);background:var(--dg-fundo);color:var(--dg-tinta);
  font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:var(--dg-verde-fundo);text-decoration:none}
a:hover{text-decoration:underline}
code,kbd{font-family:var(--dg-mono);font-size:.86em}
:focus-visible{outline:2px solid var(--dg-verde);outline-offset:2px;border-radius:6px}

/* ============================================================ esqueleto */

.dg{display:flex;min-height:100vh;align-items:flex-start}

.dg-side{width:var(--dg-lateral);background:var(--dg-barra);color:var(--dg-tinta-barra-2);
  flex-shrink:0;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.dg-side__marca{padding:20px 22px 16px}
.dg-side__logo{font-weight:800;font-size:19px;color:var(--dg-tinta-barra);line-height:1.2;
  display:flex;align-items:center;gap:9px}
.dg-side__ponto{width:11px;height:11px;border-radius:50%;background:var(--dg-verde);flex-shrink:0}
.dg-side__sub{font-size:11px;color:var(--dg-tinta-barra-2);margin-top:6px;word-break:break-word}
.dg-side__nav{overflow-y:auto;padding:6px 10px 24px;flex:1}
.dg-side__nav::-webkit-scrollbar{width:8px}
.dg-side__nav::-webkit-scrollbar-thumb{background:var(--dg-barra-2);border-radius:4px}
.dg-side__grupo{padding:14px 12px 5px;font-size:10px;text-transform:uppercase;letter-spacing:1px;
  color:var(--dg-tinta-3);font-weight:700}
.dg-side__link{display:flex;align-items:center;gap:9px;padding:8px 12px;color:var(--dg-tinta-barra-2);
  font-size:13px;border-radius:10px}
.dg-side__link:hover{background:var(--dg-barra-2);color:var(--dg-tinta-barra);text-decoration:none}
.dg-side__conta{margin-left:auto;font-size:10px;background:var(--dg-barra-2);color:var(--dg-tinta-barra-2);
  border-radius:var(--dg-pilula);padding:1px 8px;font-variant-numeric:tabular-nums}

.dg-main{flex:1;min-width:0;display:flex;flex-direction:column}
.dg-top{background:var(--dg-superficie);border-bottom:1px solid var(--dg-linha);display:flex;
  align-items:center;gap:14px;padding:12px 26px;position:sticky;top:0;z-index:20}
.dg-top__titulo{font-weight:700;font-size:15px}
.dg-top__meta{font-size:12px;color:var(--dg-tinta-2)}
.dg-top__espaco{flex:1}
.dg-top__pilula{font-size:11px;font-weight:600;padding:4px 11px;border-radius:var(--dg-pilula);
  background:var(--dg-verde-claro);color:var(--dg-verde-fundo)}

.dg-conteudo{padding:28px 30px 80px;max-width:1180px;width:100%}
.dg-sec{margin-bottom:52px;scroll-margin-top:72px}
.dg-sec__olho{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dg-verde-fundo)}
.dg-sec__titulo{font-size:25px;font-weight:800;margin:4px 0 6px;letter-spacing:-.3px;text-wrap:balance}
.dg-sec__lead{color:var(--dg-tinta-2);max-width:70ch;margin:0 0 20px}
.dg-h3{font-size:15px;font-weight:700;margin:26px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--dg-linha)}

/* ============================================================ blocos */

.dg-grid{display:grid;gap:14px}
.dg-grid--2{grid-template-columns:repeat(2,1fr)}
.dg-grid--4{grid-template-columns:repeat(4,1fr)}

.dg-card{background:var(--dg-superficie);border:1px solid var(--dg-linha);border-radius:var(--dg-raio);
  padding:18px 20px;box-shadow:var(--dg-sombra)}
/* A faixa verde nao e enfeite: marca o cartao que responde a pergunta da secao.
   Em cima de todo cartao, ela nao marcaria nada. */
.dg-card--destaque{border-color:var(--dg-verde);box-shadow:var(--dg-sombra-alta)}

.dg-kpi{background:var(--dg-superficie);border:1px solid var(--dg-linha);border-radius:var(--dg-raio);
  padding:16px 18px;box-shadow:var(--dg-sombra)}
.dg-kpi__num{font-size:29px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.dg-kpi__lbl{font-size:12px;color:var(--dg-tinta-2);margin-top:6px}

.dg-selo{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 10px;
  border-radius:var(--dg-pilula);border:1px solid var(--dg-linha);background:var(--dg-superficie);color:var(--dg-tinta-2)}
.dg-selo--ok{background:var(--dg-verde-claro);color:var(--dg-verde-fundo);border-color:transparent}
.dg-selo--info{background:var(--dg-info-fundo);color:var(--dg-info);border-color:transparent}
.dg-selo--atencao{background:var(--dg-atencao-fundo);color:var(--dg-atencao);border-color:transparent}
.dg-selo--alerta{background:var(--dg-alerta-fundo);color:var(--dg-alerta);border-color:transparent}
.dg-selo--neutro{background:var(--dg-superficie-2);color:var(--dg-tinta-2);border-color:transparent}

/* ============================================================ tabelas */

.dg-tabela-wrap{overflow-x:auto;border:1px solid var(--dg-linha);border-radius:var(--dg-raio);
  background:var(--dg-superficie);box-shadow:var(--dg-sombra)}
table.dg-tabela{width:100%;border-collapse:collapse;font-size:13px}
.dg-tabela th{text-align:left;background:var(--dg-superficie-2);border-bottom:1px solid var(--dg-linha);
  padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;
  color:var(--dg-tinta-2);white-space:nowrap;position:sticky;top:0}
.dg-tabela td{padding:9px 14px;border-bottom:1px solid var(--dg-linha);vertical-align:top}
.dg-tabela tr:last-child td{border-bottom:none}
.dg-tabela tbody tr:hover{background:var(--dg-superficie-2)}
.dg-tabela td code{background:var(--dg-superficie-2);padding:1px 6px;border-radius:5px}
.dg-tabela--matriz td{text-align:center;font-weight:700;font-variant-numeric:tabular-nums}
.dg-tabela--matriz td.dg-l{text-align:left;font-weight:600;white-space:nowrap}
.dg-cel-R{color:var(--dg-info)} .dg-cel-W{color:var(--dg-atencao)} .dg-cel-RW{color:var(--dg-verde-fundo)}

.dg-medidor{height:8px;border-radius:5px;background:var(--dg-superficie-2);overflow:hidden}
.dg-medidor__fill{height:100%;background:var(--dg-verde);border-radius:5px}

.dg-aviso{background:var(--dg-atencao-fundo);border:1px solid var(--dg-atencao);border-radius:var(--dg-raio);
  padding:13px 16px;font-size:12.5px;color:var(--dg-tinta)}
.dg-nota{background:var(--dg-verde-claro);border:1px solid var(--dg-verde);border-radius:var(--dg-raio);
  padding:14px 16px;font-size:13px}
.dg-nota code{background:var(--dg-superficie);padding:1px 5px;border-radius:5px}

.dg-chips{display:flex;flex-wrap:wrap;gap:6px}
.dg-chip{font-size:11px;background:var(--dg-superficie-2);color:var(--dg-tinta-2);border-radius:7px;
  padding:2px 8px;font-family:var(--dg-mono)}
.dg-chip--fn{background:var(--dg-info-fundo);color:var(--dg-info)}
.dg-dica{font-size:12px;color:var(--dg-tinta-2)}
.dg-vazio{color:var(--dg-tinta-3);font-style:italic;font-size:13px}

a.dg-flink code{background:var(--dg-superficie-2);padding:1px 6px;border-radius:5px;color:var(--dg-tinta)}
a.dg-flink:hover{text-decoration:none}
a.dg-flink:hover code{background:var(--dg-verde-claro);color:var(--dg-verde-fundo)}

/* ============================================================ diagramas */

.dg-diagrama{background:var(--dg-superficie);border:1px solid var(--dg-linha);border-radius:var(--dg-raio);
  padding:18px;box-shadow:var(--dg-sombra);overflow:auto}
/* O grafo pode ficar alto; resize:vertical deixa quem le esticar a caixa. */
.dg-diagrama--grafo{max-height:78vh;resize:vertical}
.dg-legenda{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0 0;font-size:12px;color:var(--dg-tinta-2)}
.dg-legenda span{display:inline-flex;align-items:center;gap:6px}
.dg-legenda i{width:12px;height:12px;border-radius:4px;display:inline-block}

/* Nos e arestas do SVG. Sem script eles ficam parados e legiveis, que e o
   essencial; com script ganham o foco ao clique. */
.dg-node rect,.dg-node path{transition:filter .12s}
.dg-node:hover rect,.dg-node:hover path{filter:brightness(1.06)}
.dg-gnode{cursor:pointer}
.dg-edges{pointer-events:none}
.dg-dot{width:9px;height:9px;border-radius:3px;display:inline-block;flex-shrink:0}

/* Os design tokens lidos do CSS do projeto documentado. */
.dg-tokens{display:flex;flex-wrap:wrap;gap:10px}
.dg-token{display:flex;align-items:center;gap:8px;border:1px solid var(--dg-linha);border-radius:10px;
  padding:6px 10px;background:var(--dg-superficie);font-size:12px;font-family:var(--dg-mono)}
.dg-token i{width:16px;height:16px;border-radius:5px;border:1px solid var(--dg-linha-forte);flex-shrink:0}

/* A barra do KPI e a unica cor forte do cartao: com ela em cima de tudo, deixa
   de marcar coisa nenhuma — por isso e fina e discreta. */
.dg-kpi__bar{height:3px;border-radius:2px;margin-top:12px;background:var(--dg-verde);opacity:.7}

/* Imprimir depende de window.print(): so existe com script. */
.dg-top__print{display:none;font-size:12px;border:1px solid var(--dg-linha-forte);background:var(--dg-superficie);
  border-radius:10px;padding:6px 12px;cursor:pointer;color:var(--dg-tinta);font-family:var(--dg-font)}
.dg-tem-js .dg-top__print{display:inline-flex}
.dg-top__print:hover{border-color:var(--dg-verde);color:var(--dg-verde-fundo)}

/* Foco no grafo: so existe com script. Sem ele o SVG continua inteiro e legivel,
   que e o que importa. */
svg.dg-grafo.is-focado .dg-gnode{opacity:.16}
svg.dg-grafo.is-focado .dg-edge{opacity:.05!important}
svg.dg-grafo.is-focado .dg-gnode.is-on,svg.dg-grafo.is-focado .dg-gnode.is-alvo{opacity:1}
svg.dg-grafo.is-focado .dg-gnode.is-alvo rect{stroke-width:3}
svg.dg-grafo.is-focado .dg-edge.is-on{opacity:1!important;stroke-width:2.4}

/* ============================================================ linha do tempo */

.dg-ver{list-style:none;margin:0;padding:0;border-left:2px solid var(--dg-linha);margin-left:6px}
.dg-ver li{position:relative;padding:0 0 14px 20px}
.dg-ver li::before{content:'';position:absolute;left:-7px;top:4px;width:11px;height:11px;border-radius:50%;
  background:var(--dg-verde);border:2px solid var(--dg-superficie)}
.dg-ver__v{font-weight:700}
.dg-ver__d{color:var(--dg-tinta-2);font-size:12px;margin-left:8px}
.dg-ver__n{display:block;color:var(--dg-tinta-2);font-size:13px;margin-top:2px}

/* ============================================================ blocos que abrem */

/* <details> e o unico jeito de abrir e fechar uma secao sem script. Tudo que
   antes era um painel controlado por clique virou isto. */
details.dg-det{background:var(--dg-superficie);border:1px solid var(--dg-linha);border-radius:var(--dg-raio);
  margin-bottom:12px;overflow:hidden;box-shadow:var(--dg-sombra)}
details.dg-det>summary{cursor:pointer;padding:14px 18px;font-weight:700;display:flex;align-items:center;
  gap:10px;list-style:none}
details.dg-det>summary::-webkit-details-marker{display:none}
details.dg-det>summary::before{content:'▸';color:var(--dg-verde-fundo);font-size:13px;flex-shrink:0}
details.dg-det[open]>summary::before{content:'▾'}
details.dg-det>summary:hover{background:var(--dg-superficie-2)}
.dg-det__corpo{padding:0 18px 16px;border-top:1px solid var(--dg-linha)}
details.dg-det--fino{box-shadow:none;background:transparent;border:none;margin:8px 0 0}
details.dg-det--fino>summary{padding:4px 0;font-size:12px;font-weight:600;color:var(--dg-verde-fundo)}
details.dg-det--fino>summary:hover{background:transparent;text-decoration:underline}
details.dg-det--fino .dg-det__corpo{padding:8px 0 0;border-top:none}

/* ============================================================ codigo */

/* A biblioteca de codigo e uma LISTA DE <details>, e nao mais um visualizador de
   dois paineis comandado por clique. O visualizador antigo guardava o codigo num
   blob JSON e o montava com script: dentro do sandbox do Abacato ele aparecia
   vazio, sem uma linha de erro. Aqui o codigo ja vem escrito e realcado no HTML.
   Custa mais bytes e funciona em todo lugar - inclusive impresso. */
.dg-lib{display:flex;flex-direction:column;gap:8px}
.dg-lib__grupo{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;
  color:var(--dg-tinta-3);margin:18px 0 2px}
.dg-arq>summary{font-family:var(--dg-font);font-weight:600;font-size:13px}
.dg-arq__ico{flex-shrink:0;width:34px;text-align:center;font-family:var(--dg-mono);font-size:8.5px;
  font-weight:700;padding:3px 0;border-radius:5px;background:var(--dg-superficie-2);color:var(--dg-tinta-2)}
.dg-arq__ico--js{background:#FEF3C7;color:#92400E}
.dg-arq__ico--ts{background:#DBEAFE;color:#1E40AF}
.dg-arq__ico--sql{background:#E0E7FF;color:#3730A3}
.dg-arq__ico--css{background:#EDE9FE;color:#5B21B6}
.dg-arq__ico--html{background:#FFE4D5;color:#9A3412}
.dg-arq__ico--md{background:var(--dg-verde-claro);color:var(--dg-verde-fundo)}
.dg-arq__meta{margin-left:auto;font-size:11px;color:var(--dg-tinta-3);font-family:var(--dg-mono);flex-shrink:0}
.dg-arq .dg-det__corpo{padding:0;border-top:1px solid var(--dg-linha)}

/* O gutter fica sticky a esquerda para o numero da linha continuar visivel
   quando o codigo rola na horizontal. */
.dg-code{display:flex;overflow:auto;max-height:70vh;font-family:var(--dg-mono);font-size:12.5px;
  line-height:1.55;background:#1E1E1E;scrollbar-color:#5a5a5a #1E1E1E}
.dg-code::-webkit-scrollbar{width:13px;height:13px}
.dg-code::-webkit-scrollbar-thumb{background:#5a5a5a;border-radius:7px;border:3px solid #1E1E1E}
.dg-code::-webkit-scrollbar-track{background:#1E1E1E}
.dg-code__gutter{flex-shrink:0;padding:12px 10px 12px 14px;text-align:right;color:#858585;white-space:pre;
  user-select:none;background:#1E1E1E;position:sticky;left:0;border-right:1px solid #2b2b2b}
.dg-code__pre{margin:0;padding:12px 18px;white-space:pre;flex:1;min-width:0;tab-size:4}
.dg-src{background:#1E1E1E;color:#D4D4D4;border-radius:10px;padding:14px 16px;overflow:auto;
  font-family:var(--dg-mono);font-size:12px;line-height:1.5;white-space:pre}

/* ============================================================ filtro (so com script) */

/* Sem script o campo nao filtra nada, e um campo que nao faz nada e pior que
   campo nenhum: a pessoa digita e conclui que o portal esta quebrado. Ele nasce
   escondido e o script o revela. */
.dg-filtro{display:none;margin:0 0 12px}
.dg-tem-js .dg-filtro{display:block}
.dg-campo{width:100%;max-width:420px;font-family:var(--dg-font);font-size:13px;padding:9px 13px;
  border:1px solid var(--dg-linha-forte);border-radius:11px;background:var(--dg-superficie);color:var(--dg-tinta)}
.dg-campo:focus{outline:none;border-color:var(--dg-verde);box-shadow:0 0 0 3px var(--dg-verde-claro)}

.dg-rodape{border-top:1px solid var(--dg-linha);padding:20px 30px;color:var(--dg-tinta-2);font-size:12px;
  display:flex;gap:16px;flex-wrap:wrap;align-items:center}

/* ============================================================ telas estreitas */

/* Sem script nao ha botao de menu. A lateral deixa de ser lateral e vira um
   bloco no topo, com os links embrulhando - o unico jeito de a navegacao existir
   no celular sem depender de clique em JavaScript. */
@media (max-width:920px){
  .dg{flex-direction:column}
  .dg-side{position:static;width:100%;height:auto;max-height:none}
  .dg-side__nav{display:flex;flex-wrap:wrap;gap:4px;padding:0 14px 16px;overflow:visible}
  .dg-side__grupo{width:100%;padding:12px 0 2px}
  .dg-side__link{border:1px solid var(--dg-barra-2);border-radius:var(--dg-pilula);padding:5px 12px;font-size:12px}
  .dg-grid--2,.dg-grid--3,.dg-grid--4{grid-template-columns:1fr}
  .dg-conteudo{padding:22px 16px 60px}
  .dg-top{padding:12px 16px}
  .dg-rodape{padding:18px 16px}
  .dg-code{max-height:60vh}
}

@media print{
  .dg-side,.dg-top,.dg-filtro{display:none!important}
  .dg-conteudo{max-width:none;padding:0}
  .dg-sec{page-break-inside:avoid}
  details.dg-det{break-inside:avoid}
  /* Impresso, tudo que abre precisa estar aberto: o leitor nao tem como clicar
     num papel. */
  details.dg-det{border:1px solid #ddd}
  details.dg-det>summary::before{content:''}
  body{background:#fff;color:#000}
  .dg-code{max-height:none;overflow:visible}
}

@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *{animation-duration:.01ms!important;transition-duration:.01ms!important}
}
`;
}

/* Inter pelo Google Fonts, sem bloquear a pintura.
   -----------------------------------------------------------------------------
   Um <link rel="stylesheet"> comum segura a renderizacao ate a resposta chegar.
   Numa rede que barra fonts.googleapis.com isso deixa a pagina parada esperando
   um timeout - num portal que existe justamente para funcionar offline. Com
   media="print" o navegador baixa sem bloquear e o onload promove a folha.

   Dentro do sandbox do Abacato o onload nao roda (nao ha script), entao ali o
   portal fica com a fonte do sistema. E o resultado certo: system-ui no Windows
   e Segoe UI, que e proxima o bastante, e nada fica esperando a rede. */
function fontLink() {
    var url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    return '<link rel="stylesheet" href="' + url + '" media="print" ' +
        'onload="this.media=\'all\';this.onload=null">';
}

module.exports = { css: css, fontLink: fontLink };
