import { useEffect, useMemo, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../lib/axios";
import { getLocalNoteVersions } from "../lib/localNotesStore";
import { updateNoteLocally } from "../lib/noteMutations";

const versionKey = (version) => version._id || version.versionId || `${version.revision}-${version.createdAt}`;

const VersionHistory = ({ note, userId, onRestored }) => {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const selected = useMemo(
    () => versions.find((version) => versionKey(version) === selectedId) || null,
    [selectedId, versions],
  );

  useEffect(() => {
    if (!open || !userId || !note) return undefined;
    let cancelled = false;
    const loadVersions = async () => {
      setLoading(true);
      const localVersions = await getLocalNoteVersions(userId, note._id || note.id);
      let nextVersions = localVersions;
      if (navigator.onLine) {
        try {
          const response = await api.get(`/notes/${encodeURIComponent(note._id || note.id)}/versions`);
          const byRevision = new Map(localVersions.map((version) => [version.revision, version]));
          (response.data || []).forEach((version) => byRevision.set(version.revision, version));
          nextVersions = Array.from(byRevision.values()).sort((left, right) => Number(right.revision || 0) - Number(left.revision || 0));
        } catch {
          // Local snapshots remain the honest offline fallback.
        }
      }
      if (!cancelled) {
        setVersions(nextVersions);
        setSelectedId(nextVersions[0] ? versionKey(nextVersions[0]) : null);
        setLoading(false);
      }
    };
    loadVersions();
    return () => { cancelled = true; };
  }, [note, open, userId]);

  const restore = async () => {
    if (!selected || !window.confirm("Restore this version as a new current revision?")) return;
    setRestoring(true);
    try {
      const result = await updateNoteLocally(userId, note, {
        title: selected.title,
        content: selected.content,
        tags: selected.tags || [],
        isPinned: Boolean(selected.isPinned),
        isFavorite: Boolean(selected.isFavorite),
      });
      onRestored(result.note);
      toast.success(navigator.onLine ? "Version restored · syncing" : "Version restored locally");
      setOpen(false);
    } catch {
      toast.error("Could not restore this version locally");
    } finally {
      setRestoring(false);
    }
  };

  return <>
    <button className="focus-toggle" onClick={() => setOpen(true)} aria-expanded={open}><History size={15} /> History</button>
    {open && <div className="version-history-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="version-history" role="dialog" aria-modal="true" aria-label="Note version history" onMouseDown={(event) => event.stopPropagation()}>
        <header className="version-history__header"><div><span className="eyebrow">Recovery</span><h2>Version history</h2><p>{navigator.onLine ? "Server history and local snapshots" : "Locally available snapshots only"}</p></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close version history"><X size={18} /></button></header>
        {loading ? <div className="version-history__empty">Loading versions...</div> : !versions.length ? <div className="version-history__empty">No previous versions are available yet.</div> : <div className="version-history__body"><nav className="version-history__list" aria-label="Available note versions">{versions.map((version) => <button key={versionKey(version)} className={versionKey(version) === selectedId ? "version-history__item version-history__item--active" : "version-history__item"} onClick={() => setSelectedId(versionKey(version))}><strong>Revision {version.revision || "local"}</strong><small>{new Date(version.createdAt || version.updatedAt).toLocaleString()}</small><span>{version.operationType?.replaceAll("_", " ") || "Saved version"}</span></button>)}</nav><div className="version-history__preview">{selected && <><div className="version-history__preview-header"><div><span className="eyebrow">Selected version</span><h3>{selected.title || "Untitled note"}</h3></div><button className="primary-button" onClick={restore} disabled={restoring}><RotateCcw size={15} /> {restoring ? "Restoring..." : "Restore version"}</button></div><div className="version-history__compare"><div><span className="eyebrow">Version content</span><pre>{selected.content}</pre></div><div><span className="eyebrow">Current content</span><pre>{note.content}</pre></div></div></>}</div></div>}
      </section>
    </div>}
  </>;
};

export default VersionHistory;
