import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  acceptInvitation,
  createInvitation,
  listMembers,
  requireManageNote,
  revokeMember,
  streamEvents,
} from "../controllers/collaborationController.js";
import { requireNoteAccess } from "../services/collaborationService.js";
import { listNoteAuditLogs } from "../controllers/auditController.js";

const router = express.Router();
router.use(requireAuth);
router.post("/invitations/accept", acceptInvitation);
router.post("/notes/:noteId/invitations", requireManageNote, createInvitation);
router.get(
  "/notes/:noteId/members",
  requireNoteAccess({ param: "noteId" }),
  listMembers,
);
router.delete(
  "/notes/:noteId/members/:userId",
  requireManageNote,
  revokeMember,
);
router.get(
  "/notes/:noteId/events",
  requireNoteAccess({ param: "noteId" }),
  streamEvents,
);
router.get("/notes/:noteId/audit", listNoteAuditLogs);

export default router;
