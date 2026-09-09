import crypto from "node:crypto";
import mongoose from "mongoose";
import Note from "../models/Note.js";
import NoteMember from "../models/NoteMember.js";
import AuditLog from "../models/AuditLog.js";
import CollaborationEvent from "../models/CollaborationEvent.js";

export const ROLES = { OWNER: "owner", EDITOR: "editor", VIEWER: "viewer" };

function noteReferenceFilter(reference) {
  return mongoose.isValidObjectId(reference)
    ? { _id: reference }
    : { clientNoteId: reference };
}

export async function getNoteAccess(noteReference, userId, includeDeleted = false) {
  const note = await Note.findOne({ ...noteReferenceFilter(noteReference), ...(includeDeleted ? {} : { deletedAt: null }) }).lean();
  if (!note) return null;
  if (String(note.user) === String(userId)) return { note, role: ROLES.OWNER };
  const member = await NoteMember.findOne({ note: note._id, user: userId, revokedAt: null, acceptedAt: { $ne: null } }).lean();
  return member ? { note, role: member.role, member } : null;
}

export async function accessibleNotesFilter(userId) {
  const memberships = await NoteMember.find({ user: userId, revokedAt: null, acceptedAt: { $ne: null } }).select("note").lean();
  return {
    deletedAt: null,
    $or: [
      { user: userId },
      { _id: { $in: memberships.map((membership) => membership.note) } },
    ],
  };
}

export function canRead(role) {
  return Boolean(role);
}

export function canEdit(role) {
  return role === ROLES.OWNER || role === ROLES.EDITOR;
}

export function canManage(role) {
  return role === ROLES.OWNER;
}

export function requireNoteAccess({ param = "id", edit = false, manage = false, includeDeleted = false } = {}) {
  return async (req, res, next) => {
    try {
      const reference = req.params[param];
      const access = await getNoteAccess(reference, req.user._id, includeDeleted);
      if (!access || (!includeDeleted && access.note.deletedAt)) return res.status(404).json({ message: "Note not found" });
      if ((edit && !canEdit(access.role)) || (manage && !canManage(access.role))) return res.status(403).json({ message: "You do not have permission for this note" });
      req.noteAccess = access;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function writeAudit({ actor, note, action, targetUser = null, metadata = {} }) {
  return AuditLog.create({ actor, note, action, targetUser, metadata });
}

export async function writeCollaborationEvent({ actor, note, type, revision = null, payload = {} }) {
  return CollaborationEvent.create({ actor, note, type, revision, payload });
}

export function createInviteToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: crypto.createHash("sha256").update(token).digest("hex") };
}

export function hashInviteToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}
