import { useEffect, useState } from "react";
import { AlertTriangle, Check, GitCompareArrows, Server } from "lucide-react";
import { getNoteConflict } from "../lib/conflictResolution";
import { keepLocalVersion, keepServerVersion } from "../lib/conflictResolution";
import { useAuth } from "../lib/useAuth";

const ConflictResolutionPanel = ({ noteId, onResolved }) => {
  const { user } = useAuth();
  const [conflict, setConflict] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = user?.id || user?._id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId || !noteId) return;
      const nextConflict = await getNoteConflict(userId, noteId);
      if (!cancelled) setConflict(nextConflict);
    };
    const handleChange = (event) => {
      if (event.detail?.userId === userId && event.detail?.noteId === noteId)
        load();
    };
    load();
    window.addEventListener("hyeboard:conflict-change", handleChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hyeboard:conflict-change", handleChange);
    };
  }, [noteId, userId]);

  if (!conflict || conflict.status !== "open") return null;

  const resolve = async (choice) => {
    setBusy(true);
    try {
      if (choice === "local") await keepLocalVersion(userId, conflict);
      if (choice === "server") await keepServerVersion(userId, conflict);
      const nextNote =
        choice === "server" ? conflict.serverNote : conflict.localNote;
      setConflict(null);
      onResolved(nextNote, choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="conflict-panel" aria-labelledby="conflict-title">
      <div className="conflict-panel__heading">
        <AlertTriangle size={18} />
        <div>
          <strong id="conflict-title">
            This note changed on another device.
          </strong>
          <p>
            Your local version is preserved. Choose which version should become
            current.
          </p>
        </div>
      </div>
      <div className="conflict-panel__actions">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setReviewOpen((value) => !value)}
        >
          <GitCompareArrows size={15} />{" "}
          {reviewOpen ? "Close review" : "Review changes"}
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => resolve("server")}
        >
          <Server size={15} /> Keep server
        </button>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => resolve("local")}
        >
          <Check size={15} /> Keep local
        </button>
      </div>
      {reviewOpen && (
        <div className="conflict-review">
          <article>
            <header>
              <strong>Your local version</strong>
              <span>Preserved locally</span>
            </header>
            <h4>{conflict.localNote?.title || "Untitled note"}</h4>
            <pre>{conflict.localNote?.content || ""}</pre>
          </article>
          <article>
            <header>
              <strong>Server version</strong>
              <span>Latest remote revision {conflict.serverRevision}</span>
            </header>
            <h4>{conflict.serverNote?.title || "Untitled note"}</h4>
            <pre>{conflict.serverNote?.content || ""}</pre>
          </article>
        </div>
      )}
      {busy && (
        <span className="conflict-panel__busy">Applying your choice…</span>
      )}
    </section>
  );
};

export default ConflictResolutionPanel;
