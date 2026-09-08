import { Heart, MoreHorizontal, Pin, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../lib/utils";
import { getNoteHref } from "../lib/noteLinks";

const NoteCard = ({
  note,
  onToggle,
  onDelete,
  isTrash = false,
  onRestore,
  onPermanentDelete,
}) => {
  const cardContent = (
    <div className="note-card__body">
      <div className="note-card__topline">
        <span className="note-card__date">
          {formatDate(new Date(note.updatedAt || note.createdAt))}
        </span>
        <div className="note-card__signals">
          {note.isPinned && <Pin size={15} fill="currentColor" />}
          {note.isFavorite && <Heart size={15} fill="currentColor" />}
        </div>
      </div>
      <h3>{note.title || "Untitled note"}</h3>
      <p>{note.content || "No content yet"}</p>
      <div className="note-card__bottomline">
        <div className="note-card__tags">
          {(note.tags || []).slice(0, 2).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        {!isTrash && (
          <div className="note-card__actions">
            <button
              className="icon-button"
              aria-label={note.isPinned ? "Unpin note" : "Pin note"}
              onClick={(event) => {
                event.preventDefault();
                onToggle(note, "isPinned");
              }}
            >
              <Pin size={16} fill={note.isPinned ? "currentColor" : "none"} />
            </button>
            <button
              className="icon-button"
              aria-label={
                note.isFavorite ? "Remove from favorites" : "Add to favorites"
              }
              onClick={(event) => {
                event.preventDefault();
                onToggle(note, "isFavorite");
              }}
            >
              <Heart
                size={16}
                fill={note.isFavorite ? "currentColor" : "none"}
              />
            </button>
            <button
              className="icon-button icon-button--danger"
              aria-label="Move note to trash"
              onClick={(event) => {
                event.preventDefault();
                onDelete?.(event, note._id);
              }}
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        )}
        {isTrash && (
          <div className="note-card__actions">
            <button
              className="text-button"
              onClick={(event) => {
                event.preventDefault();
                onRestore(note._id);
              }}
            >
              Restore
            </button>
            <button
              className="icon-button icon-button--danger"
              aria-label="Permanently delete note"
              onClick={(event) => {
                event.preventDefault();
                onPermanentDelete?.(note._id);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return isTrash ? (
    <article className="note-card">{cardContent}</article>
  ) : (
    <Link to={getNoteHref(note)} className="note-card">
      {cardContent}
    </Link>
  );
};

export default NoteCard;
