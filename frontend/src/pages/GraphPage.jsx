import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import NoteGraph from "../components/NoteGraph";
import api from "../lib/axios";
import { useAuth } from "../lib/useAuth";
import { getLocalNotesForUser, mergeServerWithLocal } from "../lib/localNotesStore";
import { deriveNoteGraph, getNoteIdentityValues, getNoteReference } from "../lib/noteLinks";

const GraphPage = () => {
  const navigate = useNavigate();
  const { id: routeNoteId } = useParams();
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineIncomplete, setOfflineIncomplete] = useState(false);
  const [scope, setScope] = useState(routeNoteId ? "local" : "full");
  const [depth, setDepth] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userId = user?.id || user?._id;
  const loadNotes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const localScope = await getLocalNotesForUser(userId);
      let nextNotes = localScope.notes || [];
      let incomplete = !navigator.onLine;
      if (navigator.onLine) {
        try {
          const response = await api.get("/notes");
          nextNotes = mergeServerWithLocal(nextNotes, response.data || []);
        } catch {
          incomplete = true;
        }
      }
      setNotes(nextNotes);
      setOfflineIncomplete(incomplete);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotes();
    const refresh = (event) => {
      if (!event.detail?.userId || event.detail.userId === userId) loadNotes();
    };
    window.addEventListener("hyeboard:notes-changed", refresh);
    window.addEventListener("hyeboard:local-change", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("hyeboard:notes-changed", refresh);
      window.removeEventListener("hyeboard:local-change", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [loadNotes, userId]);

  const currentNote = useMemo(
    () => notes.find((note) => getNoteIdentityValues(note).includes(routeNoteId)),
    [notes, routeNoteId],
  );
  const graph = useMemo(() => deriveNoteGraph(notes, {
    centerId: scope === "local" ? getNoteReference(currentNote) : undefined,
    depth,
    maxNodes: 120,
  }), [currentNote, depth, notes, scope]);

  return (
    <div className="app-shell">
      <Navbar onSearch={() => navigate("/")} onMenu={() => setMobileOpen(true)} />
      <div className={`workspace ${collapsed ? "workspace--collapsed" : ""}`}>
        <div className={`mobile-drawer-backdrop ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} />
        <div className={`sidebar-wrap ${mobileOpen ? "is-open" : ""}`}>
          <Sidebar activeView="graph" setActiveView={(view) => view === "graph" ? undefined : navigate("/")} counts={{}} tags={[]} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onClose={() => setMobileOpen(false)} />
        </div>
        <main className="main-content graph-page">
          <div className="page-heading">
            <div><span className="eyebrow">Knowledge graph</span><h2>{currentNote ? currentNote.title || "Untitled note" : "Your note relationships"}</h2><p>{offlineIncomplete ? "Offline view · showing locally available notes." : `${graph.nodes.length} notes · ${graph.edges.length} connections`}</p></div>
            <button className="icon-button refresh-button" onClick={loadNotes} aria-label="Refresh graph"><RefreshCw size={18} /></button>
          </div>
          {loading ? <div className="graph-empty"><Network className="spin" size={24} /><span>Loading relationships...</span></div> : <NoteGraph graph={graph} currentNoteId={getNoteReference(currentNote)} navigate={navigate} scope={scope} setScope={setScope} depth={depth} setDepth={setDepth} />}
        </main>
      </div>
    </div>
  );
};

export default GraphPage;
