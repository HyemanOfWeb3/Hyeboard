import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "react-hot-toast";
import NoteEditor from "../components/NoteEditor";
import { useAuth } from "../lib/useAuth";
import { createNoteLocally } from "../lib/noteMutations";

const CreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const hasDraft = title.trim() || content.trim() || tags.trim();
  const counts = useMemo(() => ({ words: content.trim() ? content.trim().split(/\s+/).length : 0, characters: content.length }), [content]);

  useEffect(() => {
    const onBeforeUnload = (event) => { if (hasDraft) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraft]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && focusMode) setFocusMode(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); document.querySelector("form")?.requestSubmit(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const goBack = () => { if (hasDraft && !window.confirm("Leave without saving this note?")) return; navigate("/"); };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) { toast.error("Add a title and some content first"); return; }
    setLoading(true);
    const userId = user?.id || user?._id;
    const normalizedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);

    try {
      await createNoteLocally(userId, { title: title.trim(), content, tags: normalizedTags });
      toast.success(navigator.onLine ? "Note queued for sync" : "Saved locally while offline", { duration: 1800 });
      navigate("/");
    } catch {
      toast.error("Could not save this note locally");
    } finally { setLoading(false); }
  };

  return <div className={`editor-page ${focusMode ? "editor-page--focus" : ""}`}>
    {!focusMode && <header className="editor-header"><button className="editor-back" onClick={goBack}><ArrowLeft size={18} /> <span>Back to notes</span></button><span className="editor-brand"><FilePlus2 size={17} /> New note</span><span className="editor-header__spacer" /></header>}
    <main className="editor-main">
      <div className="editor-document-header"><div><span className="eyebrow">Writing space</span><h1>Capture the thought.</h1></div><button className="focus-toggle" type="button" onClick={() => setFocusMode((value) => !value)}>{focusMode ? "Exit focus" : "Focus mode"}</button></div>
      <form onSubmit={handleSubmit} className="editor-document">
        <input className="editor-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled note" aria-label="Note title" autoFocus />
        <div className="editor-meta"><label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ideas, work, personal" aria-label="Note tags" /></label><span className="editor-count">{counts.words} words · {counts.characters} characters</span></div>
        <NoteEditor value={content} onChange={setContent} placeholder="Start writing... Type / for commands" />
        <footer className="editor-footer"><span>Draft stays here until you create it</span><button className="primary-button" disabled={loading}>{loading ? "Creating..." : "Create note"}</button></footer>
      </form>
    </main>
  </div>;
};

export default CreatePage;
