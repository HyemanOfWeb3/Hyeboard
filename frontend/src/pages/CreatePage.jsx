import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "react-hot-toast";
import NoteEditor from "../components/NoteEditor";
import api from "../lib/axios";

const CreatePage = () => {
  const navigate = useNavigate();
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
    try { await api.post("/notes", { title: title.trim(), content, tags: tags.split(",") }); toast.success("Note created"); navigate("/"); }
    catch (error) { toast.error(error.response?.status === 429 ? "Too many requests. Try again shortly." : "Could not create note"); }
    finally { setLoading(false); }
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
