import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  attachmentUpload,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "../controllers/attachmentsController.js";

const router = express.Router();

router.use(requireAuth);
router.get("/note/:noteId", listAttachments);
router.post("/note/:noteId", attachmentUpload, uploadAttachment);
router.delete("/:attachmentId", deleteAttachment);

export default router;
