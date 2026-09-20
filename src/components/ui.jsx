import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { T, inputStyle } from "../lib/theme";

export function Btn({ children, onClick, variant = "primary", size = "md", type = "button", disabled }) {
  const base = "inline-flex items-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm rounded-md", md: "px-4 py-2 text-sm rounded-md", lg: "px-5 py-2.5 text-base rounded-md" };
  const variants = {
    primary: { backgroundColor: T.sage, color: "#fff" },
    gold: { backgroundColor: T.gold, color: T.maroonDark },
    success: { backgroundColor: T.maroon, color: T.ivory },
    ghost: { backgroundColor: "transparent", color: T.maroon, border: `1px solid ${T.line}` },
    danger: { backgroundColor: "transparent", color: T.terracotta, border: `1px solid ${T.terracotta}55` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]}`} style={variants[variant]}>
      {children}
    </button>
  );
}

// Native <select>, but styled to not look like a cramped OS default: bigger
// touch target, no browser-drawn arrow, a custom chevron instead. Still a real
// <select> underneath (keyboard/screen-reader behavior, the native option
// picker), just dressed to match the rest of the form.
export function Select({ value, onChange, children, disabled, style }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          ...inputStyle,
          padding: "11px 38px 11px 14px",
          borderRadius: 8,
          fontSize: 14.5,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          cursor: disabled ? "default" : "pointer",
          ...style,
        }}
      >
        {children}
      </select>
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.maroon} strokeWidth="2.5"
        style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

function ToolbarButton({ onClick, title, active, children }) {
  // onMouseDown (not onClick) + preventDefault, so clicking a toolbar button
  // never steals focus from the editor first — losing focus first would
  // collapse the text selection the formatting command is supposed to act on.
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        fontSize: 13, fontWeight: 600, padding: "4px 9px", borderRadius: 6, lineHeight: 1.3,
        color: active ? T.maroonDark : T.ink,
        border: `1px solid ${active ? T.gold : T.line}`,
        background: active ? T.goldLight : "#fff",
      }}
    >
      {children}
    </button>
  );
}

// A WYSIWYG editor (Tiptap/ProseMirror) for the handful of admin-authored
// fields that should support real HTML — headings, paragraphs, lists, links —
// instead of plain text, e.g. the public homepage's About Us blurb. The
// output is raw HTML, stored and rendered as-is — safe here because only an
// authenticated admin can ever write it (same trust level as the email
// templates elsewhere in the app, which are already rendered via
// dangerouslySetInnerHTML).
//
// Renders its own label rather than being wrapped in the shared <Field>
// (a <label>) — a contentEditable region nested inside a <label> loses focus
// unreliably in WebKit, which is why the previous version of this editor
// wasn't reliably editable.
export function RichTextEditor({ label, value, onChange, placeholder, minHeight = 160 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "rich-text-content rich-text-editable" },
    },
  });

  // Keep the editor in sync if `value` changes from outside (e.g. switching
  // records) without fighting the cursor on every keystroke of our own.
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const addLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL (e.g. https://example.com):", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div>
      {label && <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>{label}</span>}
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 6 }}>
        <ToolbarButton title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>¶</ToolbarButton>
        <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
        <ToolbarButton title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>" "</ToolbarButton>
        <ToolbarButton title="Link" active={editor.isActive("link")} onClick={addLink}>🔗</ToolbarButton>
        <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</ToolbarButton>
        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>↺</ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>↻</ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        style={{ border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", cursor: "text", "--rte-min-height": `${minHeight}px` }}
      />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,33,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div
        style={{ background: T.ivory, borderRadius: 10, padding: 20, width: "100%", maxWidth: wide ? 560 : 420, maxHeight: "88vh", overflowY: "auto", overflowX: "hidden", border: `1px solid ${T.line}`, boxSizing: "border-box" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark }}>{title}</h3>
          <button onClick={onClose} style={{ color: T.inkSoft, fontSize: 18, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title = "Are you sure?", message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: T.ink, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// Extra guard for genuinely destructive, hard-to-undo actions: requires typing an
// exact confirmation string (e.g. the student's code) before the button unlocks.
export function TypeToConfirmModal({ title = "Are you sure?", message, confirmString, confirmLabel = "Confirm", onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === confirmString.toUpperCase();
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: T.ink, marginBottom: 14, lineHeight: 1.5 }}>{message}</p>
      <Field label={`Type "${confirmString}" to confirm`}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontFamily: "Inter, sans-serif", letterSpacing: 1 }}
          placeholder={confirmString}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm} disabled={!matches}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}
