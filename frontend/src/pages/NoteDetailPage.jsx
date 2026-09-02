import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Ellipsis, Heart, LoaderCircle, Pin, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-hot-toast";
import NoteEditor from "../components/NoteEditor";
import api from "../lib/axios";

const NoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("Saved");
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const savedSnapshot = useRef("");
  const hydrated = useRef(false);

  const snapshot = useMemo(() => note ? JSON.stringify({ title: note.title, content: note.content, tags }) : "", [note, tags]);
  const counts = useMemo(() => ({ words: note?.content?.trim() ? note.content.trim().split(/\s+/).length : 0, characters: note?.content?.length || 0 }), [note?.content]);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await api.get(`/notes/${id}`);
        setNote(response.data);
        setTags((response.data.tags || []).join(", "));
        savedSnapshot.current = JSON.stringify({ title: response.data.title, content: response.data.content, tags: (response.data.tags || []).join(", ") });
        hydrated.current = true;
      } catch { toast.error("Could not fetch this note"); }
      finally { setLoading(false); }
    };
    fetchNote();
  }, [id]);

  const saveNote = useCallback(async (showToast = false) => {
    if (!note || !note.title.trim() || !note.content.trim()) { setStatus("Unsaved changes"); return; }
    setStatus("Saving...");
    try {
      const response = await api.put(`/notes/${id}`, { title: note.title.trim(), content: note.content, tags: tags.split(","), isPinned: note.isPinned, isFavorite: note.isFavorite });
      setNote(response.data);
      setTags((response.data.tags || []).join(", "));
      savedSnapshot.current = JSON.stringify({ title: response.data.title, content: response.data.content, tags: (response.data.tags || []).join(", ") });
      setStatus("Saved");
      if (showToast) toast.success("Note saved", { duration: 1600 });
    } catch { setStatus("Unsaved changes"); toast.error("Could not save note"); }
  }, [id, note, tags]);

  useEffect(() => {
    if (!hydrated.current || !snapshot || snapshot === savedSnapshot.current) return undefined;
    setStatus("Unsaved changes");
    const timer = window.setTimeout(() => saveNote(), 900);
    return () => window.clearTimeout(timer);
  }, [saveNote, snapshot]);

  useEffect(() => {
    const onBeforeUnload = (event) => { if (snapshot && snapshot !== savedSnapshot.current) { event.preventDefault(); event.returnValue = ""; } };
    const onKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (event.key === "Escape" && focusMode) setFocusMode(false);
      if (modifier && event.key.toLowerCase() === "s") { event.preventDefault(); saveNote(true); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); window.removeEventListener("keydown", onKeyDown); };
  }, [focusMode, saveNote, snapshot]);

  const goBack = () => { if (snapshot !== savedSnapshot.current && !window.confirm("Leave with unsaved changes?")) return; navigate("/"); };
  const toggle = async (field) => { setNote((current) => ({ ...current, [field]: !current[field] })); };
  const deleteNote = async () => { if (!window.confirm("Move this note to trash?")) return; try { await api.delete(`/notes/${id}`); toast.success("Moved to trash"); navigate("/"); } catch { toast.error("Could not move note to trash"); } };

  if (loading) return <div className="editor-loading"><LoaderCircle className="spin" size={28} /></div>;
  if (!note) return <div className="editor-loading">Note not found</div>;

  return <div className={`editor-page ${focusMode ? "editor-page--focus" : ""}`}>
    {!focusMode && <header className="editor-header"><button className="editor-back" onClick={goBack}><ArrowLeft size={18} /> <span>Back to notes</span></button><span className="editor-brand"><Clock3 size={16} /> Last edited {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</span><div className="editor-header__actions"><span className={`save-state save-state--${status === "Saved" ? "saved" : "pending"}`}>{status === "Saved" && <Check size={14} />}{status}</span><button className="icon-button" aria-label="More actions"><Ellipsis size={19} /></button></div></header>}
    <main className="editor-main">
      <div className="editor-document-header"><div><span className="eyebrow">Note editor</span><h1>Make space for the idea.</h1></div><div className="editor-header__actions"><button className={`icon-button editor-action ${note.isPinned ? "editor-action--active" : ""}`} onClick={() => toggle("isPinned")} aria-label={note.isPinned ? "Unpin note" : "Pin note"}><Pin size={18} fill={note.isPinned ? "currentColor" : "none"} /></button><button className={`icon-button editor-action ${note.isFavorite ? "editor-action--active" : ""}`} onClick={() => toggle("isFavorite")} aria-label={note.isFavorite ? "Remove favorite" : "Favorite note"}><Heart size={18} fill={note.isFavorite ? "currentColor" : "none"} /></button><button className="focus-toggle" onClick={() => setFocusMode((value) => !value)}>{focusMode ? "Exit focus" : "Focus mode"}</button></div></div>
      <section className="editor-document">
        <input className="editor-title" value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} placeholder="Untitled note" aria-label="Note title" />
        <div className="editor-meta"><label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ideas, work, personal" aria-label="Note tags" /></label><span className="editor-count">{counts.words} words · {counts.characters} characters</span></div>
        <NoteEditor value={note.content} onChange={(content) => setNote({ ...note, content })} placeholder="Start writing... Type / for commands" />
        <footer className="editor-footer"><button className="delete-button" onClick={deleteNote}><Trash2 size={16} /> Move to trash</button><button className="primary-button" onClick={() => saveNote(true)} disabled={status === "Saving..."}>{status === "Saving..." ? "Saving..." : "Save changes"}</button></footer>
      </section>
    </main>
  </div>;
};

export default NoteDetailPage;
