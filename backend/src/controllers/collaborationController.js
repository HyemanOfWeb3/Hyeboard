import Note from "../models/Note.js";
import NoteMember from "../models/NoteMember.js";
import NoteInvitation from "../models/NoteInvitation.js";
import CollaborationEvent from "../models/CollaborationEvent.js";
import User from "../models/User.js";
import {
  canManage,
  createInviteToken,
  getNoteAccess,
  hashInviteToken,
  requireNoteAccess,
  writeAudit,
  writeCollaborationEvent,
} from "../services/collaborationService.js";

export const requireManageNote = requireNoteAccess({ param: "noteId", manage: true });

export async function createInvitation(req, res) {
  try {
    const { email, role } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || !["editor", "viewer"].includes(role)) return res.status(400).json({ message: "Valid email and role are required" });
    const invitee = await User.findOne({ email: normalizedEmail }).select("_id email");
    if (!invitee) return res.status(404).json({ message: "Invitee must have an existing HyeBoard account" });
    if (String(invitee._id) === String(req.noteAccess.note.user)) return res.status(400).json({ message: "The note owner already has access" });
    const existing = await NoteMember.findOne({ note: req.noteAccess.note._id, user: invitee._id, revokedAt: null });
    if (existing) return res.status(409).json({ message: "This user already has access" });
    const { token, tokenHash } = createInviteToken();
    const invitation = await NoteInvitation.create({ note: req.noteAccess.note._id, inviter: req.user._id, inviteeEmail: normalizedEmail, role, tokenHash, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) });
    await writeAudit({ actor: req.user._id, note: req.noteAccess.note._id, action: "invitation.created", targetUser: invitee._id, metadata: { role } });
    res.status(201).json({ invitationId: invitation._id, token, expiresAt: invitation.expiresAt, email: normalizedEmail, role });
  } catch (error) {
    console.error("Error in createInvitation:", error.message);
    res.status(500).json({ message: "Could not create invitation" });
  }
}

export async function listMembers(req, res) {
  const members = await NoteMember.find({ note: req.noteAccess.note._id, revokedAt: null }).populate("user", "email").lean();
  res.json([{ user: { _id: req.noteAccess.note.user }, role: "owner" }, ...members]);
}

export async function acceptInvitation(req, res) {
  try {
    const invitation = await NoteInvitation.findOne({ tokenHash: hashInviteToken(req.body?.token), revokedAt: null, acceptedAt: null, expiresAt: { $gt: new Date() } });
    if (!invitation) return res.status(404).json({ message: "Invitation is invalid or expired" });
    if (invitation.inviteeEmail !== req.user.email) return res.status(403).json({ message: "This invitation belongs to another account" });
    await NoteMember.findOneAndUpdate({ note: invitation.note, user: req.user._id }, { $set: { role: invitation.role, invitedBy: invitation.inviter, acceptedAt: new Date(), revokedAt: null } }, { upsert: true, new: true });
    invitation.acceptedAt = new Date();
    await invitation.save();
    await writeAudit({ actor: req.user._id, note: invitation.note, action: "invitation.accepted", metadata: { role: invitation.role } });
    await writeCollaborationEvent({ actor: req.user._id, note: invitation.note, type: "member.changed", payload: { action: "accepted", role: invitation.role } });
    res.json({ message: "Invitation accepted" });
  } catch (error) {
    console.error("Error in acceptInvitation:", error.message);
    res.status(500).json({ message: "Could not accept invitation" });
  }
}

export async function revokeMember(req, res) {
  const member = await NoteMember.findOneAndUpdate({ note: req.noteAccess.note._id, user: req.params.userId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: true });
  if (!member) return res.status(404).json({ message: "Member not found" });
  await writeAudit({ actor: req.user._id, note: req.noteAccess.note._id, action: "member.revoked", targetUser: member.user });
  await writeCollaborationEvent({ actor: req.user._id, note: req.noteAccess.note._id, type: "member.changed", payload: { action: "revoked", userId: String(member.user) } });
  res.json({ message: "Member revoked" });
}

export async function streamEvents(req, res) {
  const access = await getNoteAccess(req.params.noteId, req.user._id);
  if (!access) return res.status(404).json({ message: "Note not found" });
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders?.();
  await writeCollaborationEvent({ actor: req.user._id, note: access.note._id, type: "presence.joined", payload: {} });
  let lastSeen = new Date(req.get("Last-Event-ID") || 0);
  const send = async () => {
    const events = await CollaborationEvent.find({ note: access.note._id, createdAt: { $gt: lastSeen } }).sort({ createdAt: 1 }).limit(50).lean();
    events.forEach((event) => { lastSeen = event.createdAt; res.write(`id: ${event._id}\ndata: ${JSON.stringify({ type: event.type, revision: event.revision, payload: event.payload })}\n\n`); });
  };
  await send();
  const timer = setInterval(() => { void send().catch(() => {}); }, 3000);
  req.on("close", () => {
    clearInterval(timer);
    void writeCollaborationEvent({ actor: req.user._id, note: access.note._id, type: "presence.left", payload: {} });
  });
}
