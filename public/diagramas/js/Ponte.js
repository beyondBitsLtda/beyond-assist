/* =========================================================================
   Ponte.js — O QUADRO DENTRO DO LISA_PROOF (31/10/2026)
   -------------------------------------------------------------------------
   No exercício de desenhar (fluxo, arquitetura, banco de dados...), a página
   do Proof (e a janela do quadro da Lisa, BEYOND-0010) abre este quadro num <iframe> do mesmo
   endereço e conversa com ele:

     ?embutido=1        esconde o cabeçalho (nome, arquivos, tema) e abre vazio
     ?tema=lisa|escuro|claro o tema (na Lisa, o dela é o padrão)
     ?colecao=arch      a coleção da barra ao abrir (flow, uml, usecase, db,
                        arch, bpmn, cloud, c4)

   E expõe, para a página:
     window.PonteDoProof.exportar()      o documento inteiro (o mesmo JSON do "Exportar")
     window.PonteDoProof.importar(json)  abre um documento (o rascunho, a entrega anterior)
     window.PonteDoProof.tema('claro')   troca o tema
     window.PonteDoProof.colecao('db')   troca a coleção da barra
     window.PonteDoProof.travar(true)    só leitura (depois de avaliado, sem tentativas)
     window.PonteDoProof.novo('mindmap') documento em branco (fluxograma ou mapa mental)
     window.PonteDoProof.sql()           abre a janela "Diagrama de um schema SQL"
     window.PonteDoProof.nome('Compras') o nome do documento (vai no exportar)
   e avisa a página por postMessage: { origem: 'quadro', tipo: 'pronto' | 'mudou' | 'salvar' | 'importar' }
   (os dois últimos são o Ctrl+S e o Ctrl+O, embutido).
   Abrir um documento (importar, novo) não conta como "mudou": quem salva sozinho (o painel
   ProcessMap da Lisa, 01/11/2026) gravaria a cada abertura.
   ========================================================================= */
(function () {
  const params = new URLSearchParams(location.search);
  // dentro de um <iframe> também é embutido: se o endereço perder os parâmetros num redirecionamento,
  // o quadro continua sem cabeçalho e sem o exemplo (a página do exercício manda tema e coleção)
  const embutido = params.get('embutido') === '1' || window.self !== window.top;
  // a classe entra já na leitura do script (antes do DOMContentLoaded), para o App abrir vazio
  if (embutido) document.documentElement.classList.add('embutido');
  const TEMAS = { lisa: 'lisa', escuro: 'proof-escuro', claro: 'proof-claro' };
  document.documentElement.dataset.theme = TEMAS[params.get('tema')] || 'lisa';

  const avisar = (tipo) => {
    if (window.parent && window.parent !== window) window.parent.postMessage({ origem: 'quadro', tipo }, location.origin);
  };

  window.addEventListener('DOMContentLoaded', () => {
    const app = window.app;
    if (!app) return;
    const trocarColecao = (id) => {
      if (!id || !PM.ShapeLibrary.collections.some((c) => c.id === id)) return;
      PM.ShapeLibrary.setCollection(id);
      app.toolbar._render();
      if (app.toolbar.refresh) app.toolbar.refresh();
    };
    trocarColecao(params.get('colecao'));
    let travado = false;
    let abrindo = false; // importar/novo zeram o Ctrl+Z, e zerar avisa o histórico: não é mudança
    const semAvisar = (fazer) => { abrindo = true; try { fazer(); } finally { abrindo = false; } };

    window.PonteDoProof = {
      exportar: () => app.files.buildPayload(),
      importar(json) {
        const dados = app.files.validate(typeof json === 'string' ? JSON.parse(json) : json);
        semAvisar(() => app.manager.load(dados));
        if (dados.name) app.files.nameInput.value = dados.name;
        const caixa = app.manager.bounds();
        app.viewport.fit(caixa || null);
      },
      novo(modo) {
        const mental = modo === 'mindmap';
        semAvisar(() => app.manager.clear(mental ? 'mindmap' : undefined));
        app.files.nameInput.value = mental ? 'Novo mapa mental' : 'Novo processo';
        app.viewport.fit(mental ? app.manager.bounds() : null);
      },
      sql() { app.manager.emit('sql-import'); },
      nome(n) { app.files.nameInput.value = String(n || '').slice(0, 120); },
      tema(qual) { app.theme.apply(TEMAS[qual] || qual, true); },
      colecao: trocarColecao,
      travar(sim) {
        travado = Boolean(sim);
        document.documentElement.classList.toggle('quadro-travado', travado);
      },
      vazio: () => !app.manager.shapes.length,
    };
    // cada mudança que entra no Ctrl+Z avisa a página (ela guarda o rascunho)
    app.history.onChange(() => { if (!abrindo) avisar('mudou'); });
    // embutido, quem guarda é a página: Ctrl+S salva lá (em vez de baixar um .json) e Ctrl+O abre o
    // importar de lá (o daqui trocaria o desenho aberto sem a página saber). Na captura da janela,
    // antes do atalho do App.
    if (embutido) {
      window.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k !== 's' && k !== 'o') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        avisar(k === 's' ? 'salvar' : 'importar');
      }, true);
    }
    avisar('pronto');
  });
})();
