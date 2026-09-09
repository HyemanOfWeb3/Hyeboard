import AuditLog from "../models/AuditLog.js";
import { getNoteAccess } from "../services/collaborationService.js";

export async function listNoteAuditLogs(req, res) {
  const access = await getNoteAccess(req.params.noteId, req.user._id, true);
  if (!access || access.role !== "owner") return res.status(404).json({ message: "Note not found" });
  const logs = await AuditLog.find({ note: access.note._id }).sort({ createdAt: -1 }).limit(200).populate("actor", "email").populate("targetUser", "email").lean();
  res.json(logs);
}
