import { createElement } from "react";
import {
  Archive,
  Clock3,
  FileText,
  Heart,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Settings,
  Tag,
  Trash2,
} from "lucide-react";

const items = [
  { id: "all", label: "All notes", icon: FileText },
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "today", label: "Today", icon: Archive },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const Sidebar = ({ activeView, setActiveView, counts, tags, collapsed, onToggle, onClose }) => (
  <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
    <div className="sidebar__topline">
      {!collapsed && <span className="eyebrow">Workspace</span>}
      <button className="icon-button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
    </div>
    <nav aria-label="Notes navigation">
      <div className="sidebar__section">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? "nav-item--active" : ""}`}
            onClick={() => { setActiveView(id); onClose?.(); }}
            title={collapsed ? label : undefined}
          >
            {createElement(Icon, { size: 18, strokeWidth: 1.8 })}
            {!collapsed && <><span>{label}</span>{counts[id] > 0 && <b>{counts[id]}</b>}</>}
          </button>
        ))}
      </div>
      {!collapsed && tags.length > 0 && (
        <div className="sidebar__section sidebar__tags">
          <div className="sidebar__label"><Tag size={14} /> <span>Tags</span></div>
          {tags.slice(0, 8).map((tag) => (
            <button key={tag} className={`tag-link ${activeView === `tag:${tag}` ? "tag-link--active" : ""}`} onClick={() => { setActiveView(`tag:${tag}`); onClose?.(); }}>
              <span>#{tag}</span><small>{counts.tags?.[tag] || 0}</small>
            </button>
          ))}
        </div>
      )}
    </nav>
    {!collapsed && <button className="nav-item sidebar__settings" onClick={() => setActiveView("settings")}><Settings size={18} /><span>Settings</span></button>}
  </aside>
);

export default Sidebar;
