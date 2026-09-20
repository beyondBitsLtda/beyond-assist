/* =============================================================================
   theme.js - CSS do portal de documentacao (identidade visual DELP)
   Deriva os tokens do capex.css. Zero dependencia; fonte Barlow via Google
   Fonts com fallback para Inter/system-ui (degrada sem internet).
============================================================================= */
'use strict';

function css() {
    return `
:root{
  --dg-red:#CC0F10; --dg-red-dark:#A60C0D; --dg-red-soft:#FDECEC;
  --dg-black:#000; --dg-ink:#1A1A1A; --dg-muted:#6B6B6B;
  --dg-gray1:#B0B0B0; --dg-gray2:#EAE5DF; --dg-line:#E3DED7;
  --dg-bg:#F4F1EC; --dg-white:#FFF;
  --dg-subsea:#2362D3; --dg-industria:#FF6B05; --dg-servicos:#0B861D; --dg-mooring:#213D75;
  --dg-shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
  --dg-radius:10px; --dg-font:'Barlow','Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  --dg-mono:'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',monospace;
  --dg-sidebar:264px; --dg-topbar:56px;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--dg-font);background:var(--dg-bg);color:var(--dg-ink);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--dg-red);text-decoration:none}
a:hover{text-decoration:underline}
code,kbd{font-family:var(--dg-mono);font-size:.86em}

/* layout */
.dg{display:flex;min-height:100vh}
.dg-side{width:var(--dg-sidebar);background:var(--dg-black);color:#CFCFCF;flex-shrink:0;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.dg-side__brand{padding:18px 20px;border-bottom:1px solid #1e1e1e}
.dg-side__logo{font-weight:800;font-size:24px;letter-spacing:.5px;color:#fff;line-height:1}
.dg-side__logo b{color:var(--dg-red)}
.dg-side__sub{font-size:11px;color:#9a9a9a;margin-top:4px;text-transform:uppercase;letter-spacing:.8px}
.dg-side__nav{overflow-y:auto;padding:10px 0 24px;flex:1}
.dg-side__nav::-webkit-scrollbar{width:8px}.dg-side__nav::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
.dg-side__group{padding:14px 20px 4px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6f6f6f;font-weight:700}
.dg-side__link{display:flex;align-items:center;gap:9px;padding:8px 20px;color:#CFCFCF;font-size:13px;border-left:3px solid transparent;cursor:pointer}
.dg-side__link:hover{background:#141414;color:#fff;text-decoration:none}
.dg-side__link.is-active{background:#161616;color:#fff;border-left-color:var(--dg-red)}
.dg-side__link .dg-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dg-side__count{margin-left:auto;font-size:10px;background:#242424;color:#bdbdbd;border-radius:20px;padding:1px 8px}

.dg-main{flex:1;min-width:0;display:flex;flex-direction:column}
.dg-top{height:var(--dg-topbar);background:var(--dg-white);border-bottom:1px solid var(--dg-line);display:flex;align-items:center;gap:14px;padding:0 26px;position:sticky;top:0;z-index:20;box-shadow:var(--dg-shadow)}
.dg-top__title{font-weight:700;font-size:15px}
.dg-top__meta{font-size:12px;color:var(--dg-muted)}
.dg-top__spacer{flex:1}
.dg-top__pill{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:var(--dg-red-soft);color:var(--dg-red-dark)}
.dg-top__print{font-size:12px;border:1px solid var(--dg-line);background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;color:var(--dg-ink)}
.dg-top__print:hover{border-color:var(--dg-red);color:var(--dg-red)}

.dg-content{padding:30px 40px 80px;max-width:1180px;width:100%}
.dg-sec{margin-bottom:56px;scroll-margin-top:76px}
.dg-sec__eyebrow{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dg-red)}
.dg-sec__title{font-size:26px;font-weight:800;margin:4px 0 6px;letter-spacing:-.3px}
.dg-sec__lead{color:var(--dg-muted);max-width:70ch;margin:0 0 20px}
.dg-h3{font-size:16px;font-weight:700;margin:26px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--dg-line)}

/* cards / grid */
.dg-grid{display:grid;gap:16px}
.dg-grid--2{grid-template-columns:repeat(2,1fr)}
.dg-grid--3{grid-template-columns:repeat(3,1fr)}
.dg-grid--4{grid-template-columns:repeat(4,1fr)}
.dg-card{background:var(--dg-white);border:1px solid var(--dg-line);border-radius:var(--dg-radius);padding:18px 20px;box-shadow:var(--dg-shadow)}
.dg-card--accent{border-top:3px solid var(--dg-red)}
.dg-kpi{background:var(--dg-white);border:1px solid var(--dg-line);border-radius:var(--dg-radius);padding:16px 18px;box-shadow:var(--dg-shadow)}
.dg-kpi__num{font-size:30px;font-weight:800;line-height:1;color:var(--dg-ink)}
.dg-kpi__lbl{font-size:12px;color:var(--dg-muted);margin-top:6px;text-transform:uppercase;letter-spacing:.5px}
.dg-kpi__bar{height:3px;border-radius:2px;margin-top:12px;background:var(--dg-red);opacity:.85}

/* badges */
.dg-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;border:1px solid var(--dg-line);background:#fff;color:var(--dg-ink)}
.dg-badge--red{background:var(--dg-red-soft);color:var(--dg-red-dark);border-color:transparent}
.dg-badge--green{background:#E7F5E9;color:#0B6B18;border-color:transparent}
.dg-badge--blue{background:#E8EFFC;color:#1B4EA8;border-color:transparent}
.dg-badge--orange{background:#FFF0E6;color:#C24E00;border-color:transparent}
.dg-badge--gray{background:var(--dg-gray2);color:#4a4a4a;border-color:transparent}
.dg-badge--warn{background:#FFF6E0;color:#946200;border-color:transparent}

/* tables */
.dg-table-wrap{overflow-x:auto;border:1px solid var(--dg-line);border-radius:var(--dg-radius);background:#fff;box-shadow:var(--dg-shadow)}
table.dg-table{width:100%;border-collapse:collapse;font-size:13px}
.dg-table th{text-align:left;background:#faf8f4;border-bottom:2px solid var(--dg-line);padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#555;white-space:nowrap;position:sticky;top:0}
.dg-table td{padding:9px 14px;border-bottom:1px solid #f0ece5;vertical-align:top}
.dg-table tr:last-child td{border-bottom:none}
.dg-table tbody tr:hover{background:#fcfbf9}
.dg-table td code{background:var(--dg-gray2);padding:1px 6px;border-radius:4px}
.dg-matrix td{text-align:center;font-weight:700}
.dg-matrix td.dg-l{text-align:left;font-weight:600;white-space:nowrap}
.dg-cell-R{color:var(--dg-subsea)} .dg-cell-W{color:var(--dg-red)} .dg-cell-RW{color:var(--dg-mooring)}

/* medidor de procedencia */
.dg-meter{height:8px;border-radius:5px;background:var(--dg-gray2);overflow:hidden}
.dg-meter__fill{height:100%;background:linear-gradient(90deg,var(--dg-servicos),#2FA83F);border-radius:5px}

/* caixa de instrucao */
.dg-callout{background:var(--dg-red-soft);border:1px solid #F3C9C9;border-left:3px solid var(--dg-red);
  border-radius:var(--dg-radius);padding:14px 16px;font-size:13px;color:#5a2020}
.dg-callout code{background:rgba(255,255,255,.7);padding:1px 5px;border-radius:4px}
.dg-callout table.dg-table td{padding:5px 8px;border-color:rgba(204,15,16,.12)}

/* campos de filtro */
.dg-filtro{margin:0 0 10px}
.dg-input{width:100%;max-width:420px;font-family:var(--dg-font);font-size:13px;padding:8px 12px;
  border:1px solid var(--dg-line);border-radius:8px;background:#fff;color:var(--dg-ink)}
.dg-input:focus{outline:none;border-color:var(--dg-red);box-shadow:0 0 0 3px var(--dg-red-soft)}

/* link para o codigo-fonte */
a.dg-flink{text-decoration:none;border-bottom:1px dashed rgba(204,15,16,.4)}
a.dg-flink:hover{text-decoration:none;border-bottom-style:solid}
a.dg-flink code{background:var(--dg-gray2);padding:1px 6px;border-radius:4px;color:var(--dg-ink)}
a.dg-flink:hover code{background:var(--dg-red-soft);color:var(--dg-red-dark)}

/* diagrams */
.dg-diagram{background:#fff;border:1px solid var(--dg-line);border-radius:var(--dg-radius);padding:18px;box-shadow:var(--dg-shadow);overflow:auto}
.dg-diagram--grafo{max-height:78vh;resize:vertical}
.dg-node rect,.dg-node path{transition:filter .12s}
.dg-node:hover rect,.dg-node:hover path{filter:brightness(.97)}
.dg-gnode{cursor:pointer}
/* foco no grafo: tudo esmaece, menos o no clicado e quem se liga a ele */
svg.dg-grafo.is-focado .dg-gnode{opacity:.16}
svg.dg-grafo.is-focado .dg-edge{opacity:.05!important}
svg.dg-grafo.is-focado .dg-gnode.is-on{opacity:1}
svg.dg-grafo.is-focado .dg-gnode.is-alvo{opacity:1}
svg.dg-grafo.is-focado .dg-gnode.is-alvo rect{stroke-width:3}
svg.dg-grafo.is-focado .dg-edge.is-on{opacity:1!important;stroke-width:2.4}
.dg-legend{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0 0;font-size:12px;color:var(--dg-muted)}
.dg-legend span{display:inline-flex;align-items:center;gap:6px}
.dg-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}

/* version timeline */
.dg-ver{list-style:none;margin:0;padding:0;border-left:2px solid var(--dg-line);margin-left:6px}
.dg-ver li{position:relative;padding:0 0 14px 20px}
.dg-ver li::before{content:'';position:absolute;left:-7px;top:3px;width:11px;height:11px;border-radius:50%;background:var(--dg-red);border:2px solid #fff;box-shadow:0 0 0 1px var(--dg-line)}
.dg-ver__v{font-weight:700}.dg-ver__d{color:var(--dg-muted);font-size:12px;margin-left:8px}
.dg-ver__n{display:block;color:#333;font-size:13px;margin-top:2px}

/* file blocks / details */
details.dg-det{background:#fff;border:1px solid var(--dg-line);border-radius:var(--dg-radius);margin-bottom:12px;overflow:hidden;box-shadow:var(--dg-shadow)}
details.dg-det>summary{cursor:pointer;padding:14px 18px;font-weight:700;display:flex;align-items:center;gap:10px;list-style:none}
details.dg-det>summary::-webkit-details-marker{display:none}
details.dg-det>summary::before{content:'▸';color:var(--dg-red);font-size:13px;transition:transform .15s}
details.dg-det[open]>summary::before{transform:rotate(90deg)}
details.dg-det>summary:hover{background:#faf8f4}
.dg-det__body{padding:0 18px 16px;border-top:1px solid #f0ece5}
.dg-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0}
.dg-chips{display:flex;flex-wrap:wrap;gap:6px}
.dg-chip{font-size:11px;background:var(--dg-gray2);color:#3a3a3a;border-radius:6px;padding:2px 8px;font-family:var(--dg-mono)}
.dg-chip--fn{background:#eef2ff;color:#3949ab}
.dg-note{font-size:12px;color:var(--dg-muted)}
.dg-src{background:#1b1b1b;color:#e8e8e8;border-radius:8px;padding:14px 16px;overflow:auto;font-family:var(--dg-mono);font-size:12px;line-height:1.5;white-space:pre}
.dg-tokens{display:flex;flex-wrap:wrap;gap:10px}
.dg-token{display:flex;align-items:center;gap:8px;border:1px solid var(--dg-line);border-radius:8px;padding:6px 10px;background:#fff;font-size:12px}
.dg-token i{width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,.1)}
.dg-empty{color:var(--dg-gray1);font-style:italic;font-size:13px}
details.dg-det--sm{box-shadow:none;background:transparent;border:none;margin:8px 0 0}
details.dg-det--sm>summary{padding:4px 0;font-size:12px;font-weight:600;color:var(--dg-red)}
details.dg-det--sm>summary:hover{background:transparent;text-decoration:underline}
details.dg-det--sm .dg-det__body{padding:8px 0 0;border-top:none}

/* ------------------------------------------------ biblioteca de codigo-fonte */
/* grid-template-rows:minmax(0,1fr) e o que faz a altura de 74vh valer de fato.
   Com a linha em "auto" (padrao), a trilha crescia para caber o arquivo inteiro,
   estourava os 74vh e o excedente era cortado pelo overflow:hidden - o codigo
   ficava sem barra de rolagem e sem como ser lido ate o fim. */
.dg-lib{display:grid;grid-template-columns:288px 1fr;grid-template-rows:minmax(0,1fr);gap:0;
  border:1px solid var(--dg-line);
  border-radius:var(--dg-radius);overflow:hidden;box-shadow:var(--dg-shadow);background:#fff;height:74vh;min-height:460px;resize:vertical}
.dg-lib__aside{border-right:1px solid var(--dg-line);display:flex;flex-direction:column;min-width:0;min-height:0;background:#faf8f4}
.dg-lib__search{margin:10px;width:calc(100% - 20px);max-width:none;font-size:12px;padding:6px 10px}
.dg-lib__tree{overflow-y:auto;flex:1;padding-bottom:12px}
.dg-lib__tree::-webkit-scrollbar{width:9px}
.dg-lib__tree::-webkit-scrollbar-thumb{background:var(--dg-gray1);border-radius:5px}
.dg-lib__grupo{position:sticky;top:0;background:#f0ece5;padding:6px 12px;font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.7px;color:#6a6a6a;display:flex;gap:6px;z-index:1}
.dg-lib__grupo span{margin-left:auto;color:#9a9a9a}
.dg-lib__item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;
  padding:5px 12px;cursor:pointer;font-family:var(--dg-font);font-size:12px;color:var(--dg-ink);text-align:left}
.dg-lib__item:hover{background:#f0ece5}
.dg-lib__item.is-active{background:var(--dg-red-soft);color:var(--dg-red-dark);font-weight:600}
.dg-lib__ico{flex-shrink:0;width:32px;text-align:center;font-family:var(--dg-mono);font-size:8.5px;font-weight:700;
  padding:2px 0;border-radius:3px;background:var(--dg-gray2);color:#5a5a5a;letter-spacing:.3px}
.dg-lib__ico--js{background:#FFF4CE;color:#8a6d00}
.dg-lib__ico--sql{background:#E8EFFC;color:#1B4EA8}
.dg-lib__ico--css{background:#E9E4FB;color:#4B3BA8}
.dg-lib__ico--html,.dg-lib__ico--ftl{background:#FFE9DC;color:#B24500}
.dg-lib__ico--md{background:#E7F5E9;color:#0B6B18}
.dg-lib__nome{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-lib__ln{color:var(--dg-gray1);font-size:10px;font-family:var(--dg-mono);flex-shrink:0}
.dg-lib__view{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
.dg-lib__bar{display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--dg-line);
  background:#faf8f4;flex-shrink:0}
.dg-lib__titulo{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dg-lib__meta{font-size:11px;color:var(--dg-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-lib__meta code{background:var(--dg-gray2);padding:1px 5px;border-radius:3px}
.dg-lib__btn{border:1px solid var(--dg-line);background:#fff;border-radius:6px;padding:4px 10px;font-size:11px;
  cursor:pointer;font-family:var(--dg-font);color:var(--dg-ink);flex-shrink:0}
.dg-lib__btn:hover{border-color:var(--dg-red);color:var(--dg-red)}
.dg-lib__btn.is-on{background:var(--dg-red-soft);border-color:var(--dg-red);color:var(--dg-red-dark)}

/* visualizador de codigo (gutter + fonte).
   overflow:scroll (nao auto) para a barra vertical existir sempre: com "auto" o
   navegador a esconde ate o conteudo transbordar, e quem abre o portal nao ve
   que ali se rola. scrollbar-color/gutter mantem a barra visivel no Firefox e
   nos navegadores com barra sobreposta. */
.dg-code{display:flex;flex:1 1 auto;min-height:0;overflow:scroll;scrollbar-gutter:stable;
  scrollbar-width:auto;scrollbar-color:#5a5a5a #1E1E1E;
  font-family:var(--dg-mono);font-size:12.5px;line-height:1.55;background:#1E1E1E}
.dg-code::-webkit-scrollbar{width:14px;height:14px}
.dg-code::-webkit-scrollbar-thumb{background:#5a5a5a;border-radius:7px;border:3px solid #1E1E1E}
.dg-code::-webkit-scrollbar-thumb:hover{background:#7a7a7a}
.dg-code::-webkit-scrollbar-track{background:#1E1E1E}
.dg-code::-webkit-scrollbar-corner{background:#1E1E1E}
.dg-code__gutter{flex-shrink:0;padding:12px 10px 12px 14px;text-align:right;color:#858585;
  white-space:pre;user-select:none;background:#1E1E1E;position:sticky;left:0;border-right:1px solid #2b2b2b}
.dg-code__pre{margin:0;padding:12px 18px 12px 14px;white-space:pre;flex:1;min-width:0;tab-size:4}
.dg-code.is-wrap .dg-code__pre{white-space:pre-wrap;word-break:break-word}
.dg-code.is-wrap .dg-code__gutter{display:none}
.dg-warns{background:#FFF6E0;border:1px solid #F0D98A;border-radius:var(--dg-radius);padding:12px 16px;font-size:12px;color:#7a5300}
.dg-footer{border-top:1px solid var(--dg-line);padding:20px 40px;color:var(--dg-muted);font-size:12px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}

@media (max-width:920px){
  .dg-side{position:fixed;left:-300px;transition:left .2s;z-index:50}
  .dg-side.is-open{left:0}
  .dg-grid--2,.dg-grid--3,.dg-grid--4{grid-template-columns:1fr}
  .dg-menu-btn{display:inline-flex!important}
  .dg-lib{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);height:auto;resize:none}
  .dg-lib__aside{border-right:none;border-bottom:1px solid var(--dg-line);max-height:240px}
  .dg-code{max-height:60vh}
}
.dg-menu-btn{display:none;border:1px solid var(--dg-line);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}

@media print{
  .dg-side,.dg-top,.dg-menu-btn,.dg-filtro,.dg-lib__btn{display:none!important}
  .dg-content{max-width:none;padding:0}
  .dg-sec{page-break-inside:avoid}
  details.dg-det{break-inside:avoid}
  body{background:#fff}
  /* a biblioteca vira anexo: so o indice, sem o visualizador interativo */
  .dg-lib{grid-template-columns:1fr;grid-template-rows:auto;height:auto;break-inside:auto;resize:none}
  .dg-lib__view{display:none}
  .dg-lib__aside{max-height:none;border:none}
  .dg-diagram--grafo{max-height:none;overflow:visible}
}
`;
}

/* Google Fonts (Barlow) - carregamento NAO BLOQUEANTE.
   -----------------------------------------------------------------------------
   Um <link rel="stylesheet"> comum bloqueia a renderizacao ate a resposta chegar.
   Em rede corporativa que barra fonts.googleapis.com, isso significa a pagina
   parada ~22s esperando um timeout - num portal que existe justamente para
   funcionar offline. Medido: 22.100 ms com o link bloqueante, 144 ms sem ele.

   Com media="print" o navegador baixa a folha sem bloquear a pintura; quando (e
   se) ela chegar, o onload a promove para "all" e o Barlow entra no lugar do
   fallback. Sem internet, a pagina abre na hora com Inter/system-ui. */
function fontLink() {
    var url = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800' +
        '&family=JetBrains+Mono:wght@400;500&display=swap';
    return '<link rel="stylesheet" href="' + url + '" media="print" ' +
        'onload="this.media=\'all\';this.onload=null">';
}

module.exports = { css: css, fontLink: fontLink };
