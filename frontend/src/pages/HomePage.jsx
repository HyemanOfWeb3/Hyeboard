import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "react-hot-toast";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import RateLimitedUI from "../components/RateLimitedUI";
import api from "../lib/axios";

const HomePage = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [trash, setTrash] = useState([]);
  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const [notesResponse, trashResponse] = await Promise.all([api.get("/notes"), api.get("/notes/trash")]);
      setNotes(Array.isArray(notesResponse.data) ? notesResponse.data : []);
      setTrash(Array.isArray(trashResponse.data) ? trashResponse.data : []);
      setError("");
      setRateLimited(false);
    } catch (requestError) {
      const message = requestError.response?.data?.error || requestError.response?.data?.message || requestError.message || "Something went wrong";
      setError(message);
      setRateLimited(requestError.response?.status === 429);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotes(); }, []);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 220); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); navigate("/create"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const counts = useMemo(() => {
    const tagCounts = {};
    notes.forEach((note) => (note.tags || []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
    const today = new Date().toDateString();
    return { all: notes.length, favorites: notes.filter((note) => note.isFavorite).length, pinned: notes.filter((note) => note.isPinned).length, trash: trash.length, recent: notes.filter((note) => Date.now() - new Date(note.updatedAt || note.createdAt).getTime() < 604800000).length, today: notes.filter((note) => new Date(note.updatedAt || note.createdAt).toDateString() === today).length, tags: tagCounts };
  }, [notes, trash]);

  const visibleNotes = useMemo(() => {
    let result = activeView === "trash" ? trash : notes;
    if (activeView === "favorites") result = result.filter((note) => note.isFavorite);
    if (activeView === "pinned") result = result.filter((note) => note.isPinned);
    if (activeView === "recent") result = result.filter((note) => Date.now() - new Date(note.updatedAt || note.createdAt).getTime() < 604800000);
    if (activeView === "today") result = result.filter((note) => new Date(note.updatedAt || note.createdAt).toDateString() === new Date().toDateString());
    if (activeView.startsWith("tag:")) result = result.filter((note) => (note.tags || []).includes(activeView.slice(4)));
    if (debouncedSearch) result = result.filter((note) => `${note.title} ${note.content} ${(note.tags || []).join(" ")}`.toLowerCase().includes(debouncedSearch));
    return [...result].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "created") return new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
  }, [activeView, debouncedSearch, notes, sort, trash]);

  const updateNote = async (note, field) => {
    try {
      const response = await api.put(`/notes/${note._id}`, { [field]: !note[field] });
      setNotes((current) => current.map((item) => item._id === note._id ? response.data : item));
      toast.success(field === "isPinned" ? (note[field] ? "Note unpinned" : "Note pinned") : (note[field] ? "Removed from favorites" : "Added to favorites"), { duration: 1800 });
    } catch { toast.error("Could not update note"); }
  };

  const moveToTrash = async (event, id) => {
    if (!window.confirm("Move this note to trash?")) return;
    try { await api.delete(`/notes/${id}`); setNotes((current) => current.filter((note) => note._id !== id)); toast.success("Moved to trash"); } catch { toast.error("Could not move note to trash"); }
  };
  const restoreNote = async (id) => { try { await api.post(`/notes/${id}/restore`); setTrash((current) => current.filter((note) => note._id !== id)); toast.success("Note restored"); } catch { toast.error("Could not restore note"); } };
  const permanentlyDelete = async (id) => { if (!window.confirm("Permanently delete this note?")) return; try { await api.delete(`/notes/${id}/permanent`); setTrash((current) => current.filter((note) => note._id !== id)); toast.success("Note permanently deleted"); } catch { toast.error("Could not delete note"); } };
  const command = (id) => { setPaletteOpen(false); if (id === "create") navigate("/create"); else if (id === "sidebar") setCollapsed((value) => !value); else setActiveView(id); };
  const title = activeView === "all" ? "Your notes" : activeView.startsWith("tag:") ? `#${activeView.slice(4)}` : activeView[0].toUpperCase() + activeView.slice(1);

  return <div className="app-shell">
    <Navbar onSearch={() => setPaletteOpen(true)} onMenu={() => setMobileOpen(true)} />
    <div className={`workspace ${collapsed ? "workspace--collapsed" : ""}`}>
      <div className={`mobile-drawer-backdrop ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} />
      <div className={`sidebar-wrap ${mobileOpen ? "is-open" : ""}`}><Sidebar activeView={activeView} setActiveView={setActiveView} counts={counts} tags={Object.keys(counts.tags || {})} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onClose={() => setMobileOpen(false)} /></div>
      <main className="main-content">
        <div className="page-heading"><div><span className="eyebrow">{activeView === "trash" ? "Archive" : "Personal workspace"}</span><h2>{title}</h2><p>{activeView === "all" ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}, ready when you are.` : "A focused view of your workspace."}</p></div><button className="icon-button refresh-button" onClick={fetchNotes} aria-label="Refresh notes"><RefreshCw size={18} /></button></div>
        {rateLimited && <RateLimitedUI />}
        {error && !rateLimited && <div className="error-state"><strong>Something went wrong</strong><span>{error}</span><button className="text-button" onClick={fetchNotes}>Try again</button></div>}
        <div className="toolbar"><label className="inline-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, content, or tags" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}</label><div className="toolbar__controls"><label className="select-control"><SlidersHorizontal size={15} /><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="created">Recently created</option><option value="oldest">Oldest</option><option value="title">A-Z</option></select></label><button className="filter-button"><Filter size={15} /> <span>Filter</span></button></div></div>
        {loading ? <div className="notes-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item}><span /><span /><span /></div>)}</div> : visibleNotes.length ? <div className="notes-grid">{visibleNotes.map((note) => <NoteCard key={note._id} note={note} onToggle={updateNote} onDelete={moveToTrash} onRestore={restoreNote} onPermanentDelete={permanentlyDelete} isTrash={activeView === "trash"} />)}</div> : <NotesNotFound isSearch={Boolean(debouncedSearch)} isTrash={activeView === "trash"} />}
      </main>
    </div>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onCommand={command} />
  </div>;
};

export default HomePage;
