import { createElement, useEffect, useRef, useState } from "react";
import {
  Bold,
  CheckSquare,
  Code2,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Underline,
} from "lucide-react";

const slashCommands = [
  ["/text", "Plain text", "text"],
  ["/heading", "Heading", "heading"],
  ["/bullet", "Bullet list", "bullet"],
  ["/numbered", "Numbered list", "numbered"],
  ["/todo", "Checklist", "todo"],
  ["/quote", "Blockquote", "quote"],
  ["/code", "Code block", "code"],
  ["/divider", "Divider", "divider"],
];

const toolbarItems = [
  ["bold", "Bold", Bold],
  ["italic", "Italic", Italic],
  ["underline", "Underline", Underline],
  ["heading", "Heading", Heading2],
  ["bullet", "Bullet list", List],
  ["numbered", "Numbered list", ListOrdered],
  ["todo", "Checklist", CheckSquare],
  ["quote", "Quote", Quote],
  ["code", "Code", Code2],
  ["link", "Link", Link2],
  ["divider", "Divider", Minus],
];

const commands = {
  bold: ["**", "**", "bold text"],
  italic: ["*", "*", "italic text"],
  underline: ["<u>", "</u>", "underlined text"],
  heading: ["## ", "", "Heading"],
  bullet: ["- ", "", "List item"],
  numbered: ["1. ", "", "List item"],
  todo: ["- [ ] ", "", "Task"],
  quote: ["> ", "", "Quote"],
  code: ["`", "`", "code"],
  link: ["[", "](https://)", "link text"],
  divider: ["\n---\n", "", ""],
};

function insertText(textarea, before, after = "", placeholder = "") {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const nextValue = `${textarea.value.slice(0, start)}${before}${selected}${after}${textarea.value.slice(end)}`;
  const nextStart = start + before.length;
  return { nextValue, selectionStart: nextStart, selectionEnd: nextStart + selected.length };
}

const NoteEditor = ({ value, onChange, placeholder = "Start writing...", autoFocus = false, onDirty }) => {
  const textareaRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const applyChange = (nextValue, selectionStart, selectionEnd) => {
    onChange(nextValue);
    onDirty?.();
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const applyCommand = (command) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const [before, after, placeholder] = commands[command];
    if (slashOpen) {
      const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
      const nextValue = `${textarea.value.slice(0, lineStart)}${before}${placeholder}${after}${textarea.value.slice(textarea.selectionStart)}`;
      const nextCursor = lineStart + before.length + placeholder.length;
      applyChange(nextValue, nextCursor, nextCursor);
      setSlashOpen(false);
      setSlashQuery("");
      return;
    }
    const result = insertText(textarea, before, after, placeholder);
    applyChange(result.nextValue, result.selectionStart, result.selectionEnd);
    setSlashOpen(false);
    setSlashQuery("");
  };

  const filteredCommands = slashCommands.filter(([name, label]) => `${name} ${label}`.includes(slashQuery.toLowerCase()));

  const handleKeyDown = (event) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && ["b", "i", "u", "k"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      applyCommand({ b: "bold", i: "italic", u: "underline", k: "link" }[event.key.toLowerCase()]);
      return;
    }
    if (slashOpen) {
      if (event.key === "ArrowDown") { event.preventDefault(); setSlashIndex((index) => Math.min(index + 1, filteredCommands.length - 1)); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setSlashIndex((index) => Math.max(index - 1, 0)); return; }
      if (event.key === "Enter" && filteredCommands[slashIndex]) { event.preventDefault(); applyCommand(filteredCommands[slashIndex][2]); return; }
      if (event.key === "Escape") { event.preventDefault(); setSlashOpen(false); return; }
    }
    if (event.key === "Enter") {
      const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
      const currentLine = textarea.value.slice(lineStart, textarea.selectionStart);
      const shortcut = currentLine.match(/^(#{1,3}|[-*]|\d+\.|- \[ \]) $/);
      if (shortcut) {
        event.preventDefault();
        const replacement = shortcut[1] === "- [ ]" ? "- [ ] " : shortcut[1].endsWith(".") ? `${Number.parseInt(shortcut[1], 10) + 1}. ` : `${shortcut[1]} `;
        const nextValue = `${textarea.value.slice(0, lineStart)}${replacement}${textarea.value.slice(textarea.selectionStart)}`;
        applyChange(nextValue, lineStart + replacement.length, lineStart + replacement.length);
      }
    }
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    onDirty?.();
    const lineStart = nextValue.lastIndexOf("\n", event.target.selectionStart - 1) + 1;
    const line = nextValue.slice(lineStart, event.target.selectionStart);
    if (line.startsWith("/") && !line.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(line.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting controls">
        {toolbarItems.map(([command, label, Icon]) => <button key={command} type="button" className="editor-tool" onClick={() => applyCommand(command)} aria-label={label} title={label}>{createElement(Icon, { size: 17 })}</button>)}
      </div>
      <div className="editor-input-wrap">
        <textarea ref={textareaRef} className="note-editor" value={value} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder} aria-label="Note content" spellCheck="true" />
        {slashOpen && <div className="slash-menu" role="listbox" aria-label="Slash commands">{filteredCommands.map(([name, label, command], index) => <button key={name} type="button" className={index === slashIndex ? "slash-item slash-item--active" : "slash-item"} onMouseDown={(event) => { event.preventDefault(); applyCommand(command); }}><strong>{name}</strong><span>{label}</span></button>)}</div>}
      </div>
      <div className="editor-hint"><span>Markdown shortcuts supported</span><span>Ctrl/Cmd + B · I · U · K</span></div>
    </div>
  );
};

export default NoteEditor;
