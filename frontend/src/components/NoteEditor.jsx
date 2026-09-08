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
import api from "../lib/axios";
import { getLocalNotesForUser } from "../lib/localNotesStore";
import {
  createInternalMarkdownLink,
  findNoteTitleMatches,
} from "../lib/noteLinks";

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
  return {
    nextValue,
    selectionStart: nextStart,
    selectionEnd: nextStart + selected.length,
  };
}

const NoteEditor = ({
  value,
  onChange,
  placeholder = "Start writing...",
  autoFocus = false,
  onDirty,
  linkUserId,
}) => {
  const textareaRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkStart, setLinkStart] = useState(-1);
  const [linkNotes, setLinkNotes] = useState([]);
  const [linkIndex, setLinkIndex] = useState(0);
  const [linkLoading, setLinkLoading] = useState(false);

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
      const lineStart =
        textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
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

  const linkMatches = findNoteTitleMatches(linkNotes, linkQuery);

  const selectLinkedNote = (selectedNote) => {
    const textarea = textareaRef.current;
    if (!textarea || linkStart < 0) return;
    const inserted = createInternalMarkdownLink(selectedNote);
    const nextValue = `${textarea.value.slice(0, linkStart)}${inserted}${textarea.value.slice(textarea.selectionStart)}`;
    const cursor = linkStart + inserted.length;
    applyChange(nextValue, cursor, cursor);
    setLinkQuery("");
    setLinkStart(-1);
    setLinkIndex(0);
  };

  const filteredCommands = slashCommands.filter(([name, label]) =>
    `${name} ${label}`.includes(slashQuery.toLowerCase()),
  );

  const handleKeyDown = (event) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (linkStart >= 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLinkIndex((index) =>
          Math.min(index + 1, Math.max(linkMatches.length - 1, 0)),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLinkIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setLinkStart(-1);
        setLinkQuery("");
        return;
      }
      if (event.key === "Enter" && linkMatches[linkIndex]) {
        event.preventDefault();
        selectLinkedNote(linkMatches[linkIndex]);
        return;
      }
    }
    if (modifier && ["b", "i", "u", "k"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      applyCommand(
        { b: "bold", i: "italic", u: "underline", k: "link" }[
          event.key.toLowerCase()
        ],
      );
      return;
    }
    if (slashOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) =>
          Math.min(index + 1, filteredCommands.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" && filteredCommands[slashIndex]) {
        event.preventDefault();
        applyCommand(filteredCommands[slashIndex][2]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (event.key === "Enter") {
      const lineStart =
        textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
      const currentLine = textarea.value.slice(
        lineStart,
        textarea.selectionStart,
      );
      const shortcut = currentLine.match(/^(#{1,3}|[-*]|\d+\.|- \[ \]) $/);
      if (shortcut) {
        event.preventDefault();
        const replacement =
          shortcut[1] === "- [ ]"
            ? "- [ ] "
            : shortcut[1].endsWith(".")
              ? `${Number.parseInt(shortcut[1], 10) + 1}. `
              : `${shortcut[1]} `;
        const nextValue = `${textarea.value.slice(0, lineStart)}${replacement}${textarea.value.slice(textarea.selectionStart)}`;
        applyChange(
          nextValue,
          lineStart + replacement.length,
          lineStart + replacement.length,
        );
      }
    }
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    onDirty?.();
    const beforeCursor = nextValue.slice(0, event.target.selectionStart);
    const linkTrigger = beforeCursor.match(/\[\[([^\]]*)$/);
    if (linkTrigger) {
      setLinkQuery(linkTrigger[1]);
      setLinkStart(event.target.selectionStart - linkTrigger[0].length);
      setLinkIndex(0);
    } else {
      setLinkStart(-1);
      setLinkQuery("");
    }
    const lineStart =
      nextValue.lastIndexOf("\n", event.target.selectionStart - 1) + 1;
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
    if (linkStart < 0 || !linkUserId) return undefined;
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => setLinkLoading(true), 0);
    getLocalNotesForUser(linkUserId)
      .then(async (scope) => {
        let notes = scope.notes || [];
        if (navigator.onLine) {
          try {
            const response = await api.get("/notes");
            const byReference = new Map(
              notes.map((note) => [note._id || note.clientNoteId, note]),
            );
            (response.data || []).forEach((note) =>
              byReference.set(note._id || note.clientNoteId, note),
            );
            notes = Array.from(byReference.values());
          } catch {
            // Local candidates remain available if the network cannot be reached.
          }
        }
        if (!cancelled) setLinkNotes(notes);
      })
      .finally(() => {
        if (!cancelled) setLinkLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [linkStart, linkUserId]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="editor-shell">
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Formatting controls"
      >
        {toolbarItems.map(([command, label, Icon]) => (
          <button
            key={command}
            type="button"
            className="editor-tool"
            onClick={() => applyCommand(command)}
            aria-label={label}
            title={label}
          >
            {createElement(Icon, { size: 17 })}
          </button>
        ))}
      </div>
      <div className="editor-input-wrap">
        <textarea
          ref={textareaRef}
          className="note-editor"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Note content"
          spellCheck="true"
        />
        {linkStart >= 0 && (
          <div
            className="note-link-picker"
            role="listbox"
            aria-label="Link to a note"
          >
            <div className="note-link-picker__label">Link to a note</div>
            {linkLoading ? (
              <div className="note-link-picker__empty">
                Searching your notes...
              </div>
            ) : linkMatches.length ? (
              linkMatches.map((note, index) => (
                <button
                  key={note._id || note.clientNoteId}
                  type="button"
                  role="option"
                  aria-selected={index === linkIndex}
                  className={
                    index === linkIndex
                      ? "note-link-picker__item note-link-picker__item--active"
                      : "note-link-picker__item"
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectLinkedNote(note);
                  }}
                >
                  <strong>{note.title || "Untitled note"}</strong>
                  <span>
                    {note.content?.replace(/\s+/g, " ").slice(0, 70) ||
                      "Empty note"}
                  </span>
                </button>
              ))
            ) : (
              <div className="note-link-picker__empty">
                No matching note available offline.
              </div>
            )}
          </div>
        )}
        {slashOpen && (
          <div
            className="slash-menu"
            role="listbox"
            aria-label="Slash commands"
          >
            {filteredCommands.map(([name, label, command], index) => (
              <button
                key={name}
                type="button"
                className={
                  index === slashIndex
                    ? "slash-item slash-item--active"
                    : "slash-item"
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyCommand(command);
                }}
              >
                <strong>{name}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="editor-hint">
        <span>Markdown shortcuts supported</span>
        <span>Ctrl/Cmd + B · I · U · K</span>
      </div>
    </div>
  );
};

export default NoteEditor;
