import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Ellipsis, Heart, LoaderCircle, Pin, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-hot-toast";
import NoteEditor from "../components/NoteEditor";
import api from "../lib/axios";
import { useAuth } from "../lib/useAuth";
import { getLocalNotesForUser } from "../lib/localNotesStore";
import { trashNoteLocally, updateNoteLocally } from "../lib/noteMutations";
import { useSyncStatus } from "../lib/useSyncStatus";

const NoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const syncStatus = useSyncStatus();
  const [note, setNote] = useState(null);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("Saved");
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const savedSnapshot = useRef("");
  const hydrated = useRef(false);

  const snapshot = useMemo(() => note ? JSON.stringify({ title: note.title, content: note.content, tags, isPinned: note.isPinned, isFavorite: note.isFavorite }) : "", [note, tags]);
  const counts = useMemo(() => ({ words: note?.content?.trim() ? note.content.trim().split(/\s+/).length : 0, characters: note?.content?.length || 0 }), [note?.content]);

  useEffect(() => {
    const fetchNote = async () => {
      const userId = user?.id || user?._id;
      try {
        const response = await api.get(`/notes/${id}`);
        setNote(response.data);
        setTags((response.data.tags || []).join(", "));
        savedSnapshot.current = JSON.stringify({ title: response.data.title, content: response.data.content, tags: (response.data.tags || []).join(", "), isPinned: response.data.isPinned, isFavorite: response.data.isFavorite });
        hydrated.current = true;
      } catch {
        if (userId) {
          const { notes, trash } = await getLocalNotesForUser(userId);
          const cachedNote = [...notes, ...trash].find((item) => (item._id || item.id) === id);
          if (cachedNote) {
            setNote(cachedNote);
            setTags((cachedNote.tags || []).join(", "));
            savedSnapshot.current = JSON.stringify({ title: cachedNote.title, content: cachedNote.content, tags: (cachedNote.tags || []).join(", "), isPinned: cachedNote.isPinned, isFavorite: cachedNote.isFavorite });
            hydrated.current = true;
            setStatus("Saved locally");
            toast("Showing cached version while offline", { icon: "📦" });
            return;
          }
        }
        toast.error("Could not fetch this note");
      } finally { setLoading(false); }
    };
    fetchNote();
  }, [id, user?.id, user?._id]);

  const saveNote = useCallback(async (showToast = false) => {
    if (!note || !note.title.trim() || !note.content.trim()) { setStatus("Unsaved changes"); return; }
    const userId = user?.id || user?._id;
    const nextTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);

    try {
      const result = await updateNoteLocally(userId, note, { title: note.title.trim(), content: note.content, tags: nextTags });
      setNote(result.note);
      setTags(nextTags.join(", "));
      savedSnapshot.current = JSON.stringify({ title: result.note.title, content: result.note.content, tags: nextTags.join(", "), isPinned: result.note.isPinned, isFavorite: result.note.isFavorite });
      setStatus(navigator.onLine ? "Syncing..." : "Saved locally");
      if (showToast) toast.success(navigator.onLine ? "Saved locally · syncing" : "Saved locally", { duration: 1600 });
    } catch {
      setStatus("Unsaved changes");
      if (showToast) toast.error("Could not save this change locally");
    }
  }, [note, tags, user?.id, user?._id]);

  useEffect(() => {
    if (!hydrated.current || !snapshot || snapshot === savedSnapshot.current) return undefined;
    setStatus("Unsaved changes");
    const timer = window.setTimeout(() => saveNote(), 900);
    return () => window.clearTimeout(timer);
  }, [saveNote, snapshot]);

  useEffect(() => {
    if (status === "Syncing..." && syncStatus.status === "synced") setStatus("Saved");
    if (syncStatus.status === "conflict") setStatus("Conflict");
  }, [status, syncStatus.status]);

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
  const deleteNote = async () => {
    if (!window.confirm("Move this note to trash?")) return;
    try {
      await trashNoteLocally(user?.id || user?._id, note);
      toast.success(navigator.onLine ? "Moved to trash · syncing" : "Moved to trash locally");
      navigate("/");
    } catch { toast.error("Could not save this change locally"); }
  };

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
