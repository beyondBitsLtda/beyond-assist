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
   e avisa a página por postMessage: { origem: 'quadro', tipo: 'pronto' | 'mudou' }.
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

    window.PonteDoProof = {
      exportar: () => app.files.buildPayload(),
      importar(json) {
        const dados = app.files.validate(typeof json === 'string' ? JSON.parse(json) : json);
        app.manager.load(dados);
        const caixa = app.manager.bounds();
        app.viewport.fit(caixa || null);
      },
      tema(qual) { app.theme.apply(TEMAS[qual] || qual, true); },
      colecao: trocarColecao,
      travar(sim) {
        travado = Boolean(sim);
        document.documentElement.classList.toggle('quadro-travado', travado);
      },
      vazio: () => !app.manager.shapes.length,
    };
    // cada mudança que entra no Ctrl+Z avisa a página (ela guarda o rascunho)
    app.history.onChange(() => avisar('mudou'));
    avisar('pronto');
  });
})();
