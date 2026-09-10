import { useEffect, useState } from "react";
import { Link2, Shield, UserMinus, Users, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../lib/axios";

const SharingPanel = ({ noteId, open, onClose }) => {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [invite, setInvite] = useState(null);
  const [presence, setPresence] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    let closed = false;
    api
      .get(`/collaboration/notes/${encodeURIComponent(noteId)}/members`)
      .then((response) => {
        if (!closed) setMembers(response.data || []);
      })
      .catch(() => toast.error("Could not load note members"));
    const source = new EventSource(
      `/api/collaboration/notes/${encodeURIComponent(noteId)}/events`,
    );
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "presence.joined") setPresence((value) => value + 1);
      if (data.type === "presence.left")
        setPresence((value) => Math.max(0, value - 1));
      if (data.type === "member.changed") {
        api
          .get(`/collaboration/notes/${encodeURIComponent(noteId)}/members`)
          .then((response) => setMembers(response.data || []))
          .catch(() => {});
      }
    };
    return () => {
      closed = true;
      source.close();
    };
  }, [noteId, open]);

  if (!open) return null;
  const createInvite = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post(
        `/collaboration/notes/${encodeURIComponent(noteId)}/invitations`,
        { email, role },
      );
      setInvite(response.data);
      setEmail("");
      toast.success("Invitation created");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create invitation",
      );
    }
  };
  const revoke = async (userId) => {
    try {
      await api.delete(
        `/collaboration/notes/${encodeURIComponent(noteId)}/members/${encodeURIComponent(userId)}`,
      );
      setMembers((current) =>
        current.filter((member) => member.user?._id !== userId),
      );
      toast.success("Member revoked");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not revoke member");
    }
  };

  return (
    <div className="sharing-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="sharing-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Note sharing"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sharing-panel__header">
          <div>
            <span className="eyebrow">
              <Users size={14} /> Collaboration
            </span>
            <h2>Share this note</h2>
            <p>
              {presence
                ? `${presence} active connection${presence === 1 ? "" : "s"}`
                : "No other active connections"}
            </p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close sharing"
          >
            <X size={18} />
          </button>
        </header>
        <form className="sharing-form" onSubmit={createInvite}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Existing user email"
            aria-label="Invitee email"
            required
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-label="Member role"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="primary-button">
            <Link2 size={15} /> Invite
          </button>
        </form>
        {invite && (
          <div className="sharing-invite">
            <strong>Invitation token</strong>
            <code>{invite.token}</code>
            <small>
              Send this token securely to the invited account. It expires{" "}
              {new Date(invite.expiresAt).toLocaleString()}.
            </small>
          </div>
        )}
        <div className="sharing-members">
          <span className="eyebrow">Members</span>
          {members.map((member) => (
            <div className="sharing-member" key={member.user?._id}>
              <div>
                <strong>{member.user?.email || "Note owner"}</strong>
                <small>{member.role}</small>
              </div>
              {member.role !== "owner" && (
                <button
                  className="icon-button icon-button--danger"
                  onClick={() => revoke(member.user?._id)}
                  aria-label={`Revoke ${member.user?.email}`}
                >
                  <UserMinus size={15} />
                </button>
              )}
              <Shield size={14} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SharingPanel;
