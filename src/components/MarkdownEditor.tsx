"use client";

import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FormEvent, ReactNode, useState } from "react";

type Props = {
  id?: string;
  /** Markdown in, markdown out. */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

/**
 * WYSIWYG editor that stores markdown, so the customer site can render the same
 * content. Rich mode for clients; Markdown mode for direct edits.
 */
export default function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder = "Write a description…",
  ariaLabel = "Description",
}: Props) {
  const [mode, setMode] = useState<"rich" | "markdown">("rich");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        codeBlock: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer", target: null },
        },
      }),
      Markdown,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
        class: "rich-text min-h-48 px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(tidyMarkdown(current.getMarkdown())),
  });

  const switchMode = (next: "rich" | "markdown") => {
    if (next === mode) return;
    if (next === "rich" && editor) {
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }
    setMode(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-brown-200 bg-white focus-within:border-brown-400">
      <div className="flex flex-wrap items-center gap-1 border-b border-brown-100 bg-brown-50 px-2 py-1.5">
        {mode === "rich" && editor ? <Toolbar editor={editor} /> : null}
        <div className="ml-auto flex rounded-full bg-white p-0.5 text-xs ring-1 ring-brown-200">
          {(["rich", "markdown"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchMode(option)}
              aria-pressed={mode === option}
              className={`rounded-full px-3 py-1 font-medium ${
                mode === option ? "bg-brown-100 text-brown-900" : "text-brown-600"
              }`}
            >
              {option === "rich" ? "Rich text" : "Markdown"}
            </button>
          ))}
        </div>
      </div>

      {mode === "rich" ? (
        editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-48 px-4 py-3 text-sm text-brown-500">Loading editor…</div>
        )
      ) : (
        <textarea
          id={id}
          aria-label={`${ariaLabel} (markdown)`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={12}
          className="block min-h-48 w-full resize-y px-4 py-3 font-mono text-sm text-brown-800 focus:outline-none"
        />
      )}
    </div>
  );
}

/** Empty paragraphs serialize as runs of blank lines; markdown collapses them anyway. */
function tidyMarkdown(markdown: string): string {
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const chain = () => editor.chain().focus();

  const openLink = () => {
    setLinkUrl(state.href);
    setLinkOpen(true);
  };

  const applyLink = (event?: FormEvent) => {
    event?.preventDefault();
    const raw = linkUrl.trim();
    if (!raw) {
      chain().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
      chain().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  return (
    <>
      <ToolButton label="Bold (⌘B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Italic (⌘I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolButton>
      <Divider />
      <ToolButton
        label="Heading"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolButton>
      <ToolButton
        label="Subheading"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolButton>
      <Divider />
      <ToolButton
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      >
        <ListIcon />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <NumberedListIcon />
      </ToolButton>
      <ToolButton
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <span className="text-base leading-none">“</span>
      </ToolButton>
      <ToolButton label="Link" active={state.link || linkOpen} onClick={openLink}>
        <LinkIcon />
      </ToolButton>
      <ToolButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}>
        —
      </ToolButton>
      <Divider />
      <ToolButton
        label="Undo (⌘Z)"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      >
        ↶
      </ToolButton>
      <ToolButton
        label="Redo (⇧⌘Z)"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      >
        ↷
      </ToolButton>

      {linkOpen ? (
        <div className="flex w-full items-center gap-2 pt-1.5">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyLink(event);
              if (event.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://example.com"
            aria-label="Link URL"
            className="min-w-0 flex-1 rounded-lg border border-brown-200 bg-white px-3 py-1.5 text-sm text-brown-800"
          />
          <button
            type="button"
            onClick={() => applyLink()}
            className="rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Apply
          </button>
          {state.link ? (
            <button
              type="button"
              onClick={() => {
                chain().extendMarkRange("link").unsetLink().run();
                setLinkOpen(false);
              }}
              className="px-2 text-xs font-medium text-peach-700 hover:underline"
            >
              Remove link
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="px-2 text-xs text-brown-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </>
  );
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm ${
        active
          ? "bg-brown-200 text-brown-900"
          : "text-brown-700 hover:bg-brown-100"
      } disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-brown-200" />;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="4" r="1.25" />
      <circle cx="2.5" cy="8" r="1.25" />
      <circle cx="2.5" cy="12" r="1.25" />
      <rect x="5.5" y="3.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="11.25" width="9" height="1.5" rx=".75" />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
      <text x="0.5" y="5.5" fontSize="5" fontFamily="sans-serif">1</text>
      <text x="0.5" y="9.5" fontSize="5" fontFamily="sans-serif">2</text>
      <text x="0.5" y="13.5" fontSize="5" fontFamily="sans-serif">3</text>
      <rect x="5.5" y="3.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="11.25" width="9" height="1.5" rx=".75" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-.7.7" />
      <path d="M9.5 6.5a3 3 0 0 0-4.24 0L3.14 8.62a3 3 0 0 0 4.24 4.24l.7-.7" />
    </svg>
  );
}
