// Editor de texto das matérias (Tiptap). SÓ a página do editor importa este arquivo, para o Tiptap não ir para as páginas públicas.
// Marcação suportada: parágrafo, H2/H3, negrito, itálico, sublinhado, tachado, link, listas, citação, divisor, imagem com legenda,
// vídeo do YouTube, spoiler (<details class="spoiler-box">, o mesmo do robô) e "Ver HTML".
import { useEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Bold, Code2, EyeOff, Heading2, Heading3, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Loader2, Minus, Quote, Redo, Strikethrough, Underline as UnderlineIcon, Undo, Video } from "lucide-react";

const YT_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i;

/** Imagem dentro de <figure>, com legenda editável logo abaixo (campo simples, sem React dentro do editor). */
const Figura = Image.extend({
  name: "figura",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: null as string | null, parseHTML: () => null, renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const fig = el as HTMLElement;
          const img = fig.querySelector("img");
          if (!img) return false;
          return { src: img.getAttribute("src"), alt: img.getAttribute("alt"), caption: fig.querySelector("figcaption")?.textContent?.trim() || null };
        },
      },
      { tag: "img[src]" },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const caption = (node.attrs.caption as string | null) ?? null;
    const img = mergeAttributes(HTMLAttributes);
    delete (img as Record<string, unknown>).caption;
    return ["figure", {}, ["img", img], ...(caption ? [["figcaption", {}, caption]] : [])] as never;
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("figure");
      dom.className = "my-4";
      const img = document.createElement("img");
      img.src = node.attrs.src as string;
      img.alt = (node.attrs.alt as string) ?? "";
      img.className = "max-w-full rounded-xl";
      const legenda = document.createElement("input");
      legenda.type = "text";
      legenda.placeholder = "Legenda da imagem (opcional)";
      legenda.value = (node.attrs.caption as string) ?? "";
      legenda.setAttribute("aria-label", "Legenda da imagem");
      legenda.className = "mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-[0.8rem] text-ink-soft";
      legenda.addEventListener("change", () => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, caption: legenda.value.trim() || null }));
      });
      dom.append(img, legenda);
      return { dom, stopEvent: (e: Event) => e.target === legenda, ignoreMutation: () => true };
    };
  },
});

/** Spoiler: no site vira <details> (a pessoa toca para ver). No editor fica aberto, com uma faixa avisando. */
const Spoiler = Node.create({
  name: "spoiler",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [
      {
        tag: "details.spoiler-box",
        contentElement: (el) => {
          const dentro = (el as HTMLElement).querySelector(":scope > div.spoiler-content");
          if (dentro) return dentro as HTMLElement;
          const caixa = document.createElement("div");
          for (const filho of Array.from(el.childNodes)) if (filho.nodeName.toLowerCase() !== "summary") caixa.appendChild(filho.cloneNode(true));
          if (!caixa.childNodes.length) caixa.appendChild(document.createElement("p"));
          return caixa;
        },
      },
    ];
  },
  renderHTML() {
    return ["details", { class: "spoiler-box" }, ["summary", {}, "Contém spoiler · toque para ver"], ["div", { class: "spoiler-content" }, 0]];
  },
  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "my-5 rounded-xl border border-dashed border-warn/50 bg-warn-soft";
      const faixa = document.createElement("div");
      faixa.contentEditable = "false";
      faixa.className = "border-b border-warn/30 px-3 py-1.5 text-[0.7rem] font-bold tracking-wider text-warn uppercase";
      faixa.textContent = "Spoiler · o leitor toca para ver";
      const contentDOM = document.createElement("div");
      contentDOM.className = "px-3 py-2";
      dom.append(faixa, contentDOM);
      return { dom, contentDOM, ignoreMutation: (m) => m.type !== "selection" && !contentDOM.contains(m.target) };
    };
  },
});

/** Limpa o HTML colado do Google Docs, Word ou de outros sites (tira estilos e classes que vêm do site de origem). */
function limparColado(html: string): string {
  return html
    .replace(/<b(\s[^>]*?id="docs-internal-guid-[^"]*"[^>]*)?>([\s\S]*?)<\/b>/gi, (_m, _a, dentro) => dentro)
    .replace(/<(b|strong)(\s[^>]*?)?style="[^"]*font-weight\s*:\s*(?:normal|400)[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, _a, dentro) => dentro)
    .replace(/<\/?(?:font|o:p)[^>]*>/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "");
}

type Props = { value: string; onChange: (html: string) => void; onEnviarImagem: (arquivo: File) => Promise<string | null>; desabilitado?: boolean };

const botao = (ativo: boolean) => `grid size-11 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink sm:size-9 ${ativo ? "bg-brand-soft !text-brand dark:!text-glow" : ""}`;
const divisor = <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />;

export function EditorTexto({ value, onChange, onEnviarImagem, desabilitado }: Props) {
  const [verHtml, setVerHtml] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const ultimo = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !desabilitado,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Figura,
      Spoiler,
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: "w-full aspect-video rounded-xl" } }),
      Placeholder.configure({ placeholder: "Escreva a matéria aqui…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "prose-ap min-h-[420px] px-4 py-3 focus:outline-none", "aria-label": "Texto da matéria" },
      transformPastedHTML: limparColado,
      handlePaste(_view, event) {
        const itens = event.clipboardData?.items;
        if (itens) {
          for (const it of Array.from(itens)) {
            if (it.type.startsWith("image/")) {
              const f = it.getAsFile();
              if (f) {
                event.preventDefault();
                void enviar(f);
                return true;
              }
            }
          }
        }
        const texto = event.clipboardData?.getData("text/plain")?.trim();
        if (texto && YT_RE.test(texto)) {
          event.preventDefault();
          editorRef.current?.chain().focus().setYoutubeVideo({ src: texto }).run();
          return true;
        }
        return false;
      },
      handleDrop(_view, event) {
        const f = (event as DragEvent).dataTransfer?.files?.[0];
        if (f?.type.startsWith("image/")) {
          event.preventDefault();
          void enviar(f);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      ultimo.current = e.getHTML();
      onChange(ultimo.current);
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Texto vindo de fora (restaurar versão, recuperar cópia): recarrega no editor sem disparar "alterou".
  useEffect(() => {
    if (!editor || value === ultimo.current) return;
    ultimo.current = value;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);
  useEffect(() => {
    editor?.setEditable(!desabilitado);
  }, [editor, desabilitado]);

  async function enviar(f: File) {
    setEnviando(true);
    try {
      const url = await onEnviarImagem(f);
      if (url) editorRef.current?.chain().focus().insertContent({ type: "figura", attrs: { src: url, alt: null, caption: null } }).run();
    } finally {
      setEnviando(false);
    }
  }

  if (!editor) return <div className="h-[480px] animate-pulse rounded-xl border border-line bg-surface motion-reduce:animate-none" aria-busy="true" />;

  const link = () => {
    const atual = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Endereço do link (deixe vazio para tirar o link)", atual);
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  const video = () => {
    const url = window.prompt("Endereço do vídeo do YouTube");
    if (url?.trim() && YT_RE.test(url.trim())) editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
    else if (url?.trim()) window.alert("Esse endereço não parece ser do YouTube.");
  };
  // A cadeia de comandos precisa nascer a cada clique (uma guardada ficaria com o estado velho do editor).
  const c = () => editor.chain().focus();

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div role="toolbar" aria-label="Formatação" className="sticky top-14 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-xl border-b border-line bg-surface/95 px-2 py-1.5 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" className={botao(false)} onClick={() => c().undo().run()} title="Desfazer" aria-label="Desfazer"><Undo className="size-4" aria-hidden /></button>
        <button type="button" className={botao(false)} onClick={() => c().redo().run()} title="Refazer" aria-label="Refazer"><Redo className="size-4" aria-hidden /></button>
        {divisor}
        <button type="button" className={botao(editor.isActive("heading", { level: 2 }))} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Título" aria-label="Título"><Heading2 className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("heading", { level: 3 }))} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Subtítulo" aria-label="Subtítulo"><Heading3 className="size-4" aria-hidden /></button>
        {divisor}
        <button type="button" className={botao(editor.isActive("bold"))} onClick={() => c().toggleBold().run()} title="Negrito" aria-label="Negrito"><Bold className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("italic"))} onClick={() => c().toggleItalic().run()} title="Itálico" aria-label="Itálico"><Italic className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("underline"))} onClick={() => c().toggleUnderline().run()} title="Sublinhado" aria-label="Sublinhado"><UnderlineIcon className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("strike"))} onClick={() => c().toggleStrike().run()} title="Tachado" aria-label="Tachado"><Strikethrough className="size-4" aria-hidden /></button>
        {divisor}
        <button type="button" className={botao(editor.isActive("bulletList"))} onClick={() => c().toggleBulletList().run()} title="Lista" aria-label="Lista"><List className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("orderedList"))} onClick={() => c().toggleOrderedList().run()} title="Lista numerada" aria-label="Lista numerada"><ListOrdered className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("blockquote"))} onClick={() => c().toggleBlockquote().run()} title="Citação" aria-label="Citação"><Quote className="size-4" aria-hidden /></button>
        <button type="button" className={botao(false)} onClick={() => c().setHorizontalRule().run()} title="Divisor" aria-label="Divisor"><Minus className="size-4" aria-hidden /></button>
        {divisor}
        <button type="button" className={botao(editor.isActive("link"))} onClick={link} title="Link" aria-label="Link"><LinkIcon className="size-4" aria-hidden /></button>
        <button type="button" className={botao(false)} onClick={() => arquivo.current?.click()} disabled={enviando} title="Enviar imagem" aria-label="Enviar imagem">
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
        </button>
        <button type="button" className={botao(false)} onClick={video} title="Vídeo do YouTube" aria-label="Vídeo do YouTube"><Video className="size-4" aria-hidden /></button>
        <button type="button" className={botao(editor.isActive("spoiler"))} onClick={() => (editor.isActive("spoiler") ? c().lift("spoiler").run() : c().wrapIn("spoiler").run())} title="Esconder trecho com spoiler (selecione os parágrafos)" aria-label="Spoiler"><EyeOff className="size-4" aria-hidden /></button>
        {divisor}
        <button type="button" className={botao(verHtml)} onClick={() => setVerHtml((v) => !v)} title="Ver o HTML" aria-label="Ver o HTML" aria-pressed={verHtml}><Code2 className="size-4" aria-hidden /></button>
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
            e.target.value = "";
          }}
        />
      </div>
      {verHtml ? (
        <textarea
          aria-label="HTML da matéria"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block min-h-[420px] w-full resize-y rounded-b-xl bg-sunken/40 p-4 font-mono text-[0.8rem] leading-relaxed focus:outline-none"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
