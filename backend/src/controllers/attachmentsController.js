import crypto from "node:crypto";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import multer from "multer";
import Attachment from "../models/Attachment.js";
import Note from "../models/Note.js";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_URL_TTL_SECONDS,
  MAX_ATTACHMENTS_PER_NOTE,
  SUPPORTED_ATTACHMENT_TYPES,
  getAttachmentBucket,
  getObjectStorageClient,
} from "../config/objectStorage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 },
});

export const attachmentUpload = (req, res, next) => upload.single("file")(req, res, (error) => {
  if (!error) return next();
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Attachment exceeds the 4 MB limit" });
  return res.status(400).json({ message: "Could not read attachment" });
});

function noteFilter(noteId, userId, includeDeleted = false) {
  const filter = { user: userId, $or: [{ _id: noteId }, { clientNoteId: noteId }] };
  if (!includeDeleted) filter.deletedAt = null;
  return filter;
}

function safeFilename(filename) {
  const base = path.basename(String(filename || "attachment"));
  const cleaned = base.replace(/[\u0000-\u001F\\/]+/g, "_").trim();
  return (cleaned || "attachment").slice(0, 255);
}

async function validateFile(file) {
  const declaredType = String(file.mimetype || "").toLowerCase();
  if (!SUPPORTED_ATTACHMENT_TYPES.has(declaredType)) throw new Error("Unsupported attachment type");
  const detected = await fileTypeFromBuffer(file.buffer);
  if (declaredType.startsWith("text/")) {
    if (file.buffer.includes(0)) throw new Error("Text attachment contains binary data");
  } else if (!detected || detected.mime !== declaredType) {
    throw new Error("Attachment content does not match its declared type");
  }
  return declaredType;
}

async function noteForUser(noteId, userId, includeDeleted = false) {
  return Note.findOne(noteFilter(noteId, userId, includeDeleted)).select("_id user deletedAt");
}

async function signedAttachment(attachment, storage) {
  const url = await getSignedUrl(
    storage.client,
    new GetObjectCommand({ Bucket: storage.bucket, Key: attachment.storageKey }),
    { expiresIn: ATTACHMENT_URL_TTL_SECONDS },
  );
  return { ...attachment.toObject(), url };
}

export async function listAttachments(req, res) {
  try {
    const note = await noteForUser(req.params.noteId, req.user._id, true);
    if (!note) return res.status(404).json({ message: "Note not found" });
    const storage = getObjectStorageClient();
    const attachments = await Attachment.find({ user: req.user._id, note: note._id }).sort({ createdAt: -1 });
    res.json(await Promise.all(attachments.map((attachment) => signedAttachment(attachment, storage))));
  } catch (error) {
    console.error("Error in listAttachments:", error.message);
    res.status(error.message === "Object storage is not configured" ? 503 : 500).json({ message: "Attachments are unavailable" });
  }
}

export async function uploadAttachment(req, res) {
  let storage;
  let storageKey;
  try {
    const note = await noteForUser(req.params.noteId, req.user._id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (!req.file) return res.status(400).json({ message: "Choose a file to attach" });
    if (await Attachment.countDocuments({ note: note._id, user: req.user._id }) >= MAX_ATTACHMENTS_PER_NOTE) return res.status(409).json({ message: "This note has reached the 10 attachment limit" });
    const mimeType = await validateFile(req.file);
    storage = getObjectStorageClient();
    storageKey = `attachments/${req.user._id.toString()}/${note._id.toString()}/${crypto.randomUUID()}`;
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: storageKey,
      Body: req.file.buffer,
      ContentType: mimeType,
      ContentLength: req.file.size,
      Metadata: { originalFilename: safeFilename(req.file.originalname) },
    }));
    const attachment = await Attachment.create({
      note: note._id,
      user: req.user._id,
      filename: safeFilename(req.file.originalname),
      mimeType,
      size: req.file.size,
      storageKey,
    });
    res.status(201).json(await signedAttachment(attachment, storage));
  } catch (error) {
    if (storage && storageKey) await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: storageKey })).catch(() => {});
    const status = error.message === "Object storage is not configured" ? 503 : error.message.includes("Unsupported") || error.message.includes("does not match") || error.message.includes("binary") ? 415 : 500;
    console.error("Error in uploadAttachment:", error.message);
    res.status(status).json({ message: status === 500 ? "Could not upload attachment" : error.message });
  }
}

export async function deleteAttachment(req, res) {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.attachmentId, user: req.user._id });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    const storage = getObjectStorageClient();
    await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: attachment.storageKey }));
    await attachment.deleteOne();
    res.json({ message: "Attachment deleted" });
  } catch (error) {
    console.error("Error in deleteAttachment:", error.message);
    res.status(error.message === "Object storage is not configured" ? 503 : 500).json({ message: "Could not delete attachment" });
  }
}

export async function deleteAttachmentsForNote(noteId, userId) {
  const attachments = await Attachment.find({ note: noteId, user: userId });
  if (!attachments.length) return;
  const storage = getObjectStorageClient();
  await Promise.all(attachments.map((attachment) => storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: attachment.storageKey }))));
  await Attachment.deleteMany({ note: noteId, user: userId });
}

export { getAttachmentBucket };
