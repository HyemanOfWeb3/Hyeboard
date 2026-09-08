import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  getLocalNotesForUser,
  mergeServerWithLocal,
} from "../lib/localNotesStore";
import {
  deriveBacklinks,
  deriveOutgoingLinks,
  deriveRelatedNotes,
  getNoteHref,
  getNoteReference,
  parseInternalLinks,
} from "../lib/noteLinks";
import api from "../lib/axios";

const NoteLinkPreview = ({ content, userId, note }) => {
  const [targets, setTargets] = useState({});
  const [availableNotes, setAvailableNotes] = useState([]);
  const links = useMemo(() => parseInternalLinks(content), [content]);
  const backlinks = useMemo(
    () => deriveBacklinks(availableNotes, note),
    [availableNotes, note],
  );
  const outgoingNotes = useMemo(
    () => deriveOutgoingLinks(availableNotes, note),
    [availableNotes, note],
  );
  const relatedNotes = useMemo(
    () => deriveRelatedNotes(availableNotes, note),
    [availableNotes, note],
  );

  useEffect(() => {
    let cancelled = false;
    const resolveLinks = async () => {
      if (!userId) {
        setTargets({});
        setAvailableNotes([]);
        return;
      }
      const localScope = await getLocalNotesForUser(userId);
      let notes = localScope.notes || [];
      if (navigator.onLine) {
        try {
          const response = await api.get("/notes");
          notes = mergeServerWithLocal(notes, response.data || []);
        } catch {
          // Cached active notes remain the complete local fallback.
        }
      }
      const resolved = {};
      links.forEach((link) => {
        const note = notes.find(
          (candidate) =>
            getNoteReference(candidate) === link.reference ||
            candidate._id === link.reference ||
            candidate.clientNoteId === link.reference,
        );
        if (note) resolved[link.reference] = note;
      });
      if (!cancelled) {
        setTargets(resolved);
        setAvailableNotes(notes);
      }
    };
    const timer = window.setTimeout(resolveLinks, 250);
    const handleNotesChanged = () => resolveLinks();
    window.addEventListener("hyeboard:notes-changed", handleNotesChanged);
    window.addEventListener("hyeboard:local-change", handleNotesChanged);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("hyeboard:notes-changed", handleNotesChanged);
      window.removeEventListener("hyeboard:local-change", handleNotesChanged);
    };
  }, [content, links, userId]);

  const renderLine = (line, lineIndex) => {
    const parts = [];
    const pattern = /\[([^\]]+)\]\(\/note\/([^)]+)\)/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(line))) {
      if (match.index > cursor) parts.push(line.slice(cursor, match.index));
      const target = targets[decodeURIComponent(match[2])];
      parts.push(
        target ? (
          <Link
            key={`${lineIndex}-${match.index}`}
            to={getNoteHref(target)}
            className="note-content-preview__link"
          >
            {match[1]}
          </Link>
        ) : (
          <span
            key={`${lineIndex}-${match.index}`}
            className="note-content-preview__link note-content-preview__link--broken"
            title="The linked note is unavailable"
          >
            {match[1]} — note unavailable
          </span>
        ),
      );
      cursor = pattern.lastIndex;
    }
    if (cursor < line.length) parts.push(line.slice(cursor));
    return parts.length ? parts : [line];
  };

  return (
    <section
      className="note-link-preview"
      aria-label="Linked notes and rendered content"
    >
      {links.length > 0 && <div className="note-content-preview">
        <span className="eyebrow">Preview</span>
        <div>
          {content.split("\n").map((line, index) => (
            <p key={index}>{renderLine(line, index)}</p>
          ))}
        </div>
      </div>}
      {links.length > 0 && <div id="linked-notes" className="note-context-section"><span className="eyebrow">Linked notes</span><div className="note-link-preview__list">
        {outgoingNotes.map((target) => (
          <Link key={getNoteReference(target)} to={getNoteHref(target)} className="note-link-preview__item">
            <span>{target.title || "Untitled note"}</span>
            <small>Outgoing link</small>
          </Link>
        ))}
        {links.some((link) => !targets[link.reference]) && <span className="note-link-preview__item note-link-preview__item--broken"><span>Unavailable link</span><small>Note is not available locally</small></span>}
      </div></div>}
      <div id="backlinks" className="backlink-section note-context-section" aria-labelledby="backlinks-heading">
        <span className="eyebrow" id="backlinks-heading">Linked from</span>
        {backlinks.length ? <div className="backlink-list">{backlinks.map((sourceNote) => <Link key={getNoteReference(sourceNote)} to={getNoteHref(sourceNote)} className="backlink-item"><strong>{sourceNote.title || "Untitled note"}</strong><small>Updated {new Date(sourceNote.updatedAt || sourceNote.createdAt).toLocaleDateString()}</small></Link>)}</div> : <p className="backlink-empty">No notes link to this note yet.</p>}
      </div>
      {relatedNotes.length > 0 && <div id="related-notes" className="note-context-section related-notes-section"><span className="eyebrow">Related notes</span><small className="context-explanation">Shared tags, not semantic similarity</small><div className="backlink-list">{relatedNotes.map((relatedNote) => <Link key={getNoteReference(relatedNote)} to={getNoteHref(relatedNote)} className="backlink-item"><strong>{relatedNote.title || "Untitled note"}</strong><small>{(relatedNote.tags || []).join(" · ")}</small></Link>)}</div></div>}
      <div className="note-context-footer">
        <span className="eyebrow">Tags</span>
        <span className="note-context-tags">{note?.tags?.length ? note.tags.map((tag) => `#${tag}`).join(" ") : "No tags"}</span>
        <Link className="text-button" to={`/graph/${encodeURIComponent(getNoteReference(note))}`}>Open graph</Link>
      </div>
    </section>
  );
};

export default NoteLinkPreview;
