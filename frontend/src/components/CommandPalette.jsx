import { createElement, useEffect, useState } from "react";
import {
  Command,
  FilePlus2,
  Heart,
  LayoutGrid,
  Network,
  PanelLeft,
  Pin,
  Search,
  Settings,
  Trash2,
  Unlink2,
} from "lucide-react";

const defaultCommands = [
  ["all", "Open all notes", LayoutGrid],
  ["create", "Create a new note", FilePlus2],
  ["favorites", "Show favorites", Heart],
  ["pinned", "Show pinned notes", Pin],
  ["trash", "Open trash", Trash2],
  ["graph", "Open knowledge graph", Network],
  ["orphans", "Show orphan notes", Unlink2],
  ["sidebar", "Toggle sidebar", PanelLeft],
  ["settings", "Open settings", Settings],
];

const CommandPalette = ({ open, onClose, onCommand, extraCommands = [] }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const commands = [...defaultCommands, ...extraCommands];
  const filtered = commands.filter(([, label]) =>
    label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((value) => Math.min(value + 1, filtered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter" && filtered[selected]) {
        event.preventDefault();
        onCommand(filtered[selected][0]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onCommand, filtered, selected]);

  if (!open) return null;
  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette__search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder="Search commands..."
          />
        </div>
        <div className="command-palette__list">
          {filtered.length ? (
            filtered.map(([id, label, Icon], index) => (
              <button
                key={id}
                className={
                  index === selected
                    ? "command-item command-item--active"
                    : "command-item"
                }
                onMouseEnter={() => setSelected(index)}
                onClick={() => onCommand(id)}
              >
                {createElement(Icon, { size: 17 })}
                <span>{label}</span>
                <kbd>{index < 9 ? index + 1 : ""}</kbd>
              </button>
            ))
          ) : (
            <div className="command-empty">
              <Command size={20} /> No commands found
            </div>
          )}
        </div>
        <div className="command-palette__footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Select
          </span>
          <span>
            <kbd>esc</kbd> Close
          </span>
        </div>
      </section>
    </div>
  );
};

export default CommandPalette;
