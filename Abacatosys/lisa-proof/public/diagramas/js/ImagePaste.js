/* =========================================================================
   ImagePaste.js — COPIAR E COLAR (Ctrl+C / Ctrl+X / Ctrl+V), INCLUSIVE IMAGENS
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Classe de suporte dedicada à ÁREA DE TRANSFERÊNCIA do sistema:
     • Ctrl+V com uma IMAGEM copiada (print, Ferramenta de Captura, imagem
       copiada do navegador/Teams/Word...) → cria uma forma de imagem.
     • Ctrl+C / Ctrl+X em formas → copia o desenho (como texto) para a área
       de transferência do sistema, permitindo colar até em outra aba.
     • Ctrl+V com formas copiadas → cola as formas.

   BASE64 — POR QUE A IMAGEM "VIRA TEXTO"
   Como não gravamos nada em banco ou em disco, a imagem é convertida em uma
   "data URL": data:image/png;base64,iVBORw0KGgo...  Isso é o arquivo da
   imagem escrito com letras e números (Base64). Esse texto é guardado em
   memória (ShapeManager.assets) e, ao exportar, vai dentro do JSON — uma
   única linha de código que carrega a imagem inteira.

   EVENTOS DO NAVEGADOR USADOS
   • "copy", "cut", "paste": disparados pelo navegador com Ctrl+C/X/V.
     Eles dão acesso a e.clipboardData (conteúdo da área de transferência).
     Por segurança, o navegador só libera esse conteúdo dentro desses eventos.
   • FileReader.readAsDataURL: lê o arquivo da imagem e devolve o base64.
   • <canvas>: usado para REDUZIR imagens muito grandes (economiza memória e
     deixa o JSON menor).
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.ImagePaste = class ImagePaste {
  /**
   * @param manager  ShapeManager (cria as formas)
   * @param viewport Viewport (posição visível do quadro)
   * @param wrap     <div> do quadro (saber se o mouse está sobre ele)
   * @param notify   função de mensagem (toast)
   */
  constructor({ manager, viewport, wrap, notify }) {
    this.m = manager;
    this.vp = viewport;
    this.wrap = wrap;
    this.notify = notify;
    this.MARK = 'PROCESSMAP:';   // prefixo que identifica um texto copiado pelo ProcessMap
    this.MAX_SIDE = 1600;        // lado máximo (px) da imagem guardada; maiores são reduzidas
    this.lastPoint = null;       // última posição do mouse no quadro (mundo)
    this.overCanvas = false;     // o mouse está sobre o quadro?
    this._bind();
  }

  // Liga os eventos de área de transferência e acompanha a posição do mouse.
  _bind() {
    // O ShapeManager emite 'pointer' a cada movimento com a posição no mundo.
    this.m.on('pointer', (pt) => { this.lastPoint = pt; });
    this.wrap.addEventListener('pointerenter', () => { this.overCanvas = true; });
    this.wrap.addEventListener('pointerleave', () => { this.overCanvas = false; });
    // Os eventos ficam no "document" para funcionar com o foco em qualquer lugar da página.
    document.addEventListener('copy', (e) => this._onCopy(e, false));
    document.addEventListener('cut', (e) => this._onCopy(e, true));
    document.addEventListener('paste', (e) => this._onPaste(e));
  }

  // Está digitando em um campo? Então copiar/colar deve funcionar como texto normal.
  _typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  // Onde a imagem/forma colada deve aparecer: sob o mouse (se estiver no quadro)
  // ou no centro da área visível.
  _dropPoint() {
    return this.overCanvas && this.lastPoint ? this.lastPoint : this.vp.visibleCenter();
  }

  /* ---------------- Ctrl+C / Ctrl+X ---------------- */
  _onCopy(e, cut) {
    if (this._typing()) return;          // deixa o navegador copiar o texto do campo
    if (!this.m.copy()) return;          // nada selecionado: não interfere
    // Coloca o desenho na área de transferência do sistema como texto marcado.
    // Isso também "substitui" uma imagem copiada antes, evitando colar a coisa errada.
    e.clipboardData.setData('text/plain', this.MARK + this.m.clipboard);
    e.preventDefault();                  // impede o comportamento padrão do navegador
    if (cut) this.m.deleteSelection();   // Ctrl+X = copiar + excluir
    this.notify(cut ? 'Recortado.' : 'Copiado.');
  }

  /* ---------------- Ctrl+V ---------------- */
  _onPaste(e) {
    if (this._typing()) return;          // colar texto dentro de um campo: comportamento normal
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();

    // 1) Formas copiadas pelo ProcessMap (desta ou de outra aba)
    const text = cd.getData('text/plain') || '';
    if (text.startsWith(this.MARK)) {
      // slice corta o prefixo e deixa só o JSON
      if (!this.m.paste(text.slice(this.MARK.length))) this.notify('Conteúdo copiado inválido.', true);
      return;
    }

    // 2) Imagem: procura, entre os itens da área de transferência, um do tipo image/*
    // Array.from transforma a lista do navegador (DataTransferItemList) em array comum.
    const item = Array.from(cd.items || []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (item) { this.readImage(item.getAsFile()); return; }

    // 3) Nada reconhecido: tenta a área de transferência interna (ex.: Ctrl+D antes)
    if (!this.m.paste()) this.notify('Nada para colar. Copie uma imagem ou selecione formas e use Ctrl+C.', true);
  }

  /* ---------------- leitura e conversão da imagem ---------------- */

  // Lê o arquivo de imagem como base64 e cria a forma.
  // Usa Promises/async-await: "await" espera a operação assíncrona terminar
  // sem travar a tela (alternativa moderna aos callbacks).
  async readImage(file) {
    if (!file) return;
    // No mapa mental o quadro é uma árvore de tópicos: imagem solta não tem lugar nele.
    if (this.m.mode === 'mindmap') { this.notify('Imagens não entram no mapa mental: use um fluxograma.', true); return; }
    try {
      const dataUrl = await this._fileToDataUrl(file);        // arquivo → "data:image/...;base64,..."
      const img = await this._loadImage(dataUrl);              // descobre largura/altura reais
      const fit = this._downscale(img, file.type);             // reduz se for muito grande
      const pt = this._dropPoint();
      this.m.addImage(fit.src, fit.w, fit.h, pt.x, pt.y);      // cria a forma no quadro
      const kb = Math.round(fit.src.length * 0.75 / 1024);     // base64 tem ~33% a mais que o binário
      this.notify(`Imagem colada (${fit.w}×${fit.h}px · ~${kb} KB no JSON).`);
    } catch (err) {
      this.notify('Não foi possível ler a imagem colada.', true);
    }
  }

  // Envolve o FileReader (que usa callbacks) em uma Promise, para poder usar "await".
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);   // sucesso → devolve o texto base64
      r.onerror = reject;                   // erro → rejeita a Promise (cai no catch)
      r.readAsDataURL(file);
    });
  }

  // Carrega a data URL em um objeto Image para saber o tamanho real.
  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Se a imagem passar de MAX_SIDE pixels, redesenha menor em um <canvas>
  // e gera uma nova data URL. Mantém PNG (transparência) para PNG; demais viram JPEG.
  _downscale(img, type) {
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const k = Math.min(1, this.MAX_SIDE / Math.max(w0, h0)); // fator de redução (1 = não reduz)
    if (k === 1) return { src: img.src, w: w0, h: h0 };
    const w = Math.round(w0 * k), h = Math.round(h0 * k);
    const cv = document.createElement('canvas');            // "tela" de desenho em memória
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);          // desenha a imagem reduzida
    const out = type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
    return { src: out, w, h };
  }
};
