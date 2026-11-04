"use client";

import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, highlightSpecialChars, placeholder as dica,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, indentUnit,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { classHighlighter } from "@lezer/highlight";
import { carregarLinguagem, rotuloDaLinguagem } from "./linguagens.js";

/**
 * O editor da solução: uma IDE pequena no lugar da antiga caixa de texto.
 *
 * Números de linha, cor pela linguagem (as mesmas classes tok-* do <Codigo>, então leitura e
 * escrita têm a mesma cara), linha atual destacada, fechamento de ( [ { " ', indentação
 * automática, Tab que indenta (Esc e depois Tab sai do editor — quem usa teclado não fica preso),
 * desfazer/refazer, busca (Ctrl+F), dobrar blocos e sugestões das palavras já usadas.
 *
 * Ctrl+Enter (Cmd+Enter no Mac) chama `aoCtrlEnter`, que envia a solução.
 */
export default function EditorDeCodigo({ valor, aoMudar, linguagem, desabilitado, placeholder, aoCtrlEnter, rotulo = "Editor de código" }) {
  const caixa = useRef(null);
  const vista = useRef(null);
  const travas = useRef({ linguagem: new Compartment(), leitura: new Compartment() });
  // os callbacks mudam a cada render; o editor guarda a versão mais nova sem ser recriado
  const ultimo = useRef({ aoMudar, aoCtrlEnter });
  ultimo.current = { aoMudar, aoCtrlEnter };

  useEffect(() => {
    const t = travas.current;
    const view = new EditorView({
      parent: caixa.current,
      state: EditorState.create({
        doc: valor || "",
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          indentUnit.of("  "),
          syntaxHighlighting(classHighlighter),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          dica(placeholder || ""),
          keymap.of([
            { key: "Mod-Enter", run: () => { ultimo.current.aoCtrlEnter?.(); return true; } },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => { if (u.docChanged) ultimo.current.aoMudar?.(u.state.doc.toString()); }),
          EditorView.contentAttributes.of({ "aria-label": rotulo, spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          t.linguagem.of([]),
          t.leitura.of([EditorState.readOnly.of(Boolean(desabilitado)), EditorView.editable.of(!desabilitado)]),
        ],
      }),
    });
    vista.current = view;
    return () => { view.destroy(); vista.current = null; };
    // o editor nasce uma vez; valor, linguagem e bloqueio entram pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a linguagem chega depois (import dinâmico) e pode mudar
  useEffect(() => {
    let vivo = true;
    carregarLinguagem(linguagem).then((lang) => {
      if (vivo && vista.current) vista.current.dispatch({ effects: travas.current.linguagem.reconfigure(lang || []) });
    });
    return () => { vivo = false; };
  }, [linguagem]);

  useEffect(() => {
    vista.current?.dispatch({
      effects: travas.current.leitura.reconfigure([EditorState.readOnly.of(Boolean(desabilitado)), EditorView.editable.of(!desabilitado)]),
    });
  }, [desabilitado]);

  // valor trocado de fora (ex.: a tentativa anterior chegou do servidor)
  useEffect(() => {
    const v = vista.current;
    if (v && (valor || "") !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valor || "" } });
    }
  }, [valor]);

  const nome = rotuloDaLinguagem(linguagem);
  return (
    <div className={`pf-editor${desabilitado ? " pf-editor--travado" : ""}`}>
      <div className="pf-editor__barra">
        <span className="pf-editor__bolinhas" aria-hidden="true"><i /><i /><i /></span>
        <span className="pf-editor__nome">{nome ? `solucao · ${nome}` : "solucao"}</span>
        <span className="pf-editor__atalhos">Tab indenta · Ctrl+F busca · Ctrl+Enter envia</span>
      </div>
      <div ref={caixa} className="pf-editor__area" />
    </div>
  );
}
