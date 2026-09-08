import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Filter, Network, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "react-hot-toast";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import ImportExportPanel from "../components/ImportExportPanel";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import RateLimitedUI from "../components/RateLimitedUI";
import api from "../lib/axios";
import { useAuth } from "../lib/useAuth";
import {
  restoreNoteLocally,
  trashNoteLocally,
  updateNoteLocally,
} from "../lib/noteMutations";
import {
  getLocalNotesForUser,
  mergeServerWithLocal,
  persistLocalNotesForUser,
} from "../lib/localNotesStore";
import { deriveNoteGraph, deriveOrphanNotes, getNoteReference } from "../lib/noteLinks";

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [trash, setTrash] = useState([]);
  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const activeUserIdRef = useRef(null);

  const fetchNotes = useCallback(async () => {
    const userId = user?.id || user?._id;
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let cachedState = { notes: [], trash: [] };
    try {
      cachedState = await getLocalNotesForUser(userId);
      if (activeUserIdRef.current !== userId) return;
      if (cachedState.notes.length || cachedState.trash.length) {
        setNotes(cachedState.notes);
        setTrash(cachedState.trash);
      }
    } catch {
      cachedState = { notes: [], trash: [] };
    }

    try {
      const [notesResponse, trashResponse] = await Promise.all([
        api.get("/notes"),
        api.get("/notes/trash"),
      ]);
      const serverNotes = Array.isArray(notesResponse.data)
        ? notesResponse.data
        : [];
      const serverTrash = Array.isArray(trashResponse.data)
        ? trashResponse.data
        : [];
      if (activeUserIdRef.current !== userId) return;
      const mergedNotes = mergeServerWithLocal(cachedState.notes, serverNotes);
      const mergedTrash = mergeServerWithLocal(cachedState.trash, serverTrash);

      setNotes(mergedNotes);
      setTrash(mergedTrash);
      await persistLocalNotesForUser(userId, mergedNotes, mergedTrash);
      setError("");
      setRateLimited(false);
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        requestError.response?.data?.message ||
        requestError.message ||
        "Something went wrong";
      setError(
        window.navigator.onLine
          ? message
          : "You're offline. Showing the latest cached notes for this account.",
      );
      setRateLimited(requestError.response?.status === 429);
      if (
        !window.navigator.onLine &&
        !cachedState.notes.length &&
        !cachedState.trash.length
      ) {
        setNotes([]);
        setTrash([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const userId = user?.id || user?._id || null;
    activeUserIdRef.current = userId;
    setNotes([]);
    setTrash([]);
    if (user) {
      fetchNotes();
    }
  }, [fetchNotes, user]);
  useEffect(() => {
    const userId = user?.id || user?._id;
    const handleNotesChanged = (event) => {
      if (event.detail?.userId === userId) fetchNotes();
    };
    window.addEventListener("hyeboard:notes-changed", handleNotesChanged);
    return () =>
      window.removeEventListener("hyeboard:notes-changed", handleNotesChanged);
  }, [fetchNotes, user]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      220,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        navigate("/create");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const counts = useMemo(() => {
    const tagCounts = {};
    notes.forEach((note) =>
      (note.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }),
    );
    const today = new Date().toDateString();
    return {
      all: notes.length,
      favorites: notes.filter((note) => note.isFavorite).length,
      pinned: notes.filter((note) => note.isPinned).length,
      trash: trash.length,
      recent: notes.filter(
        (note) =>
          Date.now() - new Date(note.updatedAt || note.createdAt).getTime() <
          604800000,
      ).length,
      today: notes.filter(
        (note) =>
          new Date(note.updatedAt || note.createdAt).toDateString() === today,
      ).length,
      orphan: deriveOrphanNotes(notes).length,
      tags: tagCounts,
    };
  }, [notes, trash]);

  const relationshipIndex = useMemo(() => {
    const graph = deriveNoteGraph(notes);
    const titlesById = new Map(notes.map((note) => [getNoteReference(note), note.title || "Untitled note"]));
    const linkedIds = new Set();
    const linkedTitles = new Map();
    graph.edges.forEach((edge) => {
      linkedIds.add(edge.source);
      linkedIds.add(edge.target);
      const sourceTitles = linkedTitles.get(edge.source) || [];
      sourceTitles.push(titlesById.get(edge.target) || "");
      linkedTitles.set(edge.source, sourceTitles);
      const targetTitles = linkedTitles.get(edge.target) || [];
      targetTitles.push(titlesById.get(edge.source) || "");
      linkedTitles.set(edge.target, targetTitles);
    });
    return { linkedIds, linkedTitles };
  }, [notes]);

  const visibleNotes = useMemo(() => {
    let result = activeView === "trash" ? trash : notes;
    if (activeView === "favorites")
      result = result.filter((note) => note.isFavorite);
    if (activeView === "pinned")
      result = result.filter((note) => note.isPinned);
    if (activeView === "recent")
      result = result.filter(
        (note) =>
          Date.now() - new Date(note.updatedAt || note.createdAt).getTime() <
          604800000,
      );
    if (activeView === "today")
      result = result.filter(
        (note) =>
          new Date(note.updatedAt || note.createdAt).toDateString() ===
          new Date().toDateString(),
      );
      if (activeView === "orphan") result = deriveOrphanNotes(notes);
      if (relationshipFilter === "linked")
        result = result.filter((note) => relationshipIndex.linkedIds.has(getNoteReference(note)));
      if (relationshipFilter === "unlinked")
        result = result.filter((note) => !relationshipIndex.linkedIds.has(getNoteReference(note)));
    if (activeView.startsWith("tag:"))
      result = result.filter((note) =>
        (note.tags || []).includes(activeView.slice(4)),
      );
    if (debouncedSearch)
      result = result.filter((note) =>
        `${note.title} ${note.content} ${(note.tags || []).join(" ")} ${(relationshipIndex.linkedTitles.get(getNoteReference(note)) || []).join(" ")}`
          .toLowerCase()
          .includes(debouncedSearch),
      );
    return [...result].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "oldest")
        return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "created")
        return new Date(b.createdAt) - new Date(a.createdAt);
      return (
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt)
      );
    });
  }, [activeView, debouncedSearch, notes, relationshipFilter, relationshipIndex, sort, trash]);

  const updateNote = async (note, field) => {
    const userId = user?.id || user?._id;
    try {
      const result = await updateNoteLocally(userId, note, {
        [field]: !note[field],
      });
      setNotes(result.scope.notes);
      toast.success(
        field === "isPinned"
          ? note[field]
            ? "Note unpinned"
            : "Note pinned"
          : note[field]
            ? "Removed from favorites"
            : "Added to favorites",
        { duration: 1800 },
      );
    } catch {
      toast.error("Could not save this change locally");
    }
  };

  const moveToTrash = async (event, id) => {
    if (!window.confirm("Move this note to trash?")) return;
    const userId = user?.id || user?._id;
    const note = notes.find((item) => item._id === id);
    try {
      const result = await trashNoteLocally(userId, note);
      setNotes(result.scope.notes);
      setTrash(result.scope.trash);
      toast.success(
        navigator.onLine
          ? "Moved to trash · syncing"
          : "Moved to trash locally",
      );
    } catch {
      toast.error("Could not save this change locally");
    }
  };
  const restoreNote = async (id) => {
    const userId = user?.id || user?._id;
    const note = trash.find((item) => item._id === id);
    try {
      const result = await restoreNoteLocally(userId, note);
      setNotes(result.scope.notes);
      setTrash(result.scope.trash);
      toast.success(
        navigator.onLine ? "Note restored · syncing" : "Note restored locally",
      );
    } catch {
      toast.error("Could not save this change locally");
    }
  };
  const permanentlyDelete = async (id) => {
    if (!window.confirm("Permanently delete this note?")) return;
    try {
      await api.delete(`/notes/${id}/permanent`);
      setTrash((current) => current.filter((note) => note._id !== id));
      toast.success("Note permanently deleted");
    } catch {
      toast.error("Could not delete note");
    }
  };
  const command = (id) => {
    setPaletteOpen(false);
    if (id === "create") navigate("/create");
    else if (id === "sidebar") setCollapsed((value) => !value);
    else if (id === "graph") navigate("/graph");
    else if (id === "orphans") setActiveView("orphan");
    else setActiveView(id);
  };
  const title =
    activeView === "all"
      ? "Your notes"
      : activeView.startsWith("tag:")
        ? `#${activeView.slice(4)}`
        : activeView[0].toUpperCase() + activeView.slice(1);

  return (
    <div className="app-shell">
      <Navbar
        onSearch={() => setPaletteOpen(true)}
        onMenu={() => setMobileOpen(true)}
      />
      <div className={`workspace ${collapsed ? "workspace--collapsed" : ""}`}>
        <div
          className={`mobile-drawer-backdrop ${mobileOpen ? "is-open" : ""}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className={`sidebar-wrap ${mobileOpen ? "is-open" : ""}`}>
          <Sidebar
            activeView={activeView}
            setActiveView={setActiveView}
            counts={counts}
            tags={Object.keys(counts.tags || {})}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            onClose={() => setMobileOpen(false)}
          />
        </div>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {activeView === "trash" ? "Archive" : "Personal workspace"}
              </span>
              <h2>{title}</h2>
              <p>
                {activeView === "all"
                  ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}, ready when you are.`
                  : "A focused view of your workspace."}
              </p>
            </div>
            <button
              className="icon-button refresh-button"
              onClick={fetchNotes}
              aria-label="Refresh notes"
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {rateLimited && <RateLimitedUI />}
          {error && !rateLimited && (
            <div className="error-state">
              <strong>Something went wrong</strong>
              <span>{error}</span>
              <button className="text-button" onClick={fetchNotes}>
                Try again
              </button>
            </div>
          )}
          <div className="toolbar">
            <label className="inline-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, content, or tags"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="toolbar__controls">
              <ImportExportPanel userId={user?.id || user?._id} onComplete={fetchNotes} />
              <label className="select-control">
                <SlidersHorizontal size={15} />
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="created">Recently created</option>
                  <option value="oldest">Oldest</option>
                  <option value="title">A-Z</option>
                </select>
              </label>
              <button className="filter-button">
                <Filter size={15} /> <span>Filter</span>
              </button>
            </div>
          </div>
          <div className="relationship-filter" aria-label="Relationship filter">
            <Network size={15} />
            <span>Relationships</span>
            <select value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value)}>
              <option value="all">All notes</option>
              <option value="linked">Linked notes</option>
              <option value="unlinked">Unlinked notes</option>
            </select>
          </div>
          {loading ? (
            <div className="notes-grid">
              {[1, 2, 3, 4].map((item) => (
                <div className="skeleton-card" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : visibleNotes.length ? (
            <div className="notes-grid">
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note._id}
                  note={note}
                  onToggle={updateNote}
                  onDelete={moveToTrash}
                  onRestore={restoreNote}
                  onPermanentDelete={permanentlyDelete}
                  isTrash={activeView === "trash"}
                />
              ))}
            </div>
          ) : (
            <NotesNotFound
              isSearch={Boolean(debouncedSearch)}
              isTrash={activeView === "trash"}
            />
          )}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCommand={command}
      />
    </div>
  );
};

export default HomePage;
