import Note from "../models/Note.js";
import Mutation from "../models/Mutation.js";
import NoteVersion from "../models/NoteVersion.js";
import { deleteAttachmentsForNote } from "./attachmentsController.js";
import mongoose from "mongoose";
import {
  accessibleNotesFilter,
  getNoteAccess,
  requireNoteAccess,
  writeCollaborationEvent,
} from "../services/collaborationService.js";

function noteReferenceFilter(reference, userId, includeDeleted = false) {
  const ownership = { user: userId };
  if (!includeDeleted) ownership.deletedAt = null;
  return mongoose.isValidObjectId(reference)
    ? { ...ownership, _id: reference }
    : { ...ownership, clientNoteId: reference };
}

function operationIdFrom(req) {
  return req.body?.operationId || req.get("Idempotency-Key");
}

function baseRevisionFrom(req) {
  const value = req.body?.baseRevision;
  return value === undefined || value === null ? undefined : Number(value);
}

function addRevisionFilter(filter, revision) {
  if (revision !== undefined) {
    filter.$or = [{ revision }, { revision: { $exists: false } }];
  }
}

async function runIdempotentMutation(req, res, handler) {
  const operationId = operationIdFrom(req);
  if (!operationId) {
    const result = await handler();
    return res.status(result.status).json(result.body);
  }

  let mutation;
  try {
    mutation = await Mutation.create({ user: req.user._id, operationId });
  } catch (error) {
    if (error.code !== 11000) throw error;
    mutation = await Mutation.findOne({ user: req.user._id, operationId });
    if (mutation?.status === "completed") {
      return res.status(mutation.responseStatus).json(mutation.responseBody);
    }
    if (mutation && Date.now() - mutation.updatedAt.getTime() > 5 * 60 * 1000) {
      await Mutation.deleteOne({ _id: mutation._id });
      return runIdempotentMutation(req, res, handler);
    }
    if (mutation?.status === "processing" && req.body?.clientNoteId) {
      const existing = await Note.findOne({
        user: req.user._id,
        clientNoteId: req.body.clientNoteId,
      });
      if (existing) {
        await Mutation.updateOne(
          { _id: mutation._id },
          { status: "completed", responseStatus: 200, responseBody: existing },
        );
        return res.status(200).json(existing);
      }
    }
    return res.status(409).json({
      code: "SYNC_OPERATION_IN_PROGRESS",
      message: "This operation is already being processed",
    });
  }

  try {
    const result = await handler();
    if (result.status >= 400) {
      await Mutation.deleteOne({ _id: mutation._id });
      return res.status(result.status).json(result.body);
    }
    await Mutation.updateOne(
      { _id: mutation._id },
      {
        status: "completed",
        responseStatus: result.status,
        responseBody: result.body,
      },
    );
    return res.status(result.status).json(result.body);
  } catch (error) {
    await Mutation.deleteOne({ _id: mutation._id }).catch(() => {});
    throw error;
  }
}

function conflictResponse(res, serverNote) {
  return res.status(409).json({
    code: "REVISION_CONFLICT",
    message: "The note changed elsewhere",
    serverNote,
  });
}

async function saveVersion(note, operationType = "UPDATE_NOTE") {
  if (!note?._id || !note.user || !note.revision) return;
  await NoteVersion.updateOne(
    { user: note.user, note: note._id, revision: note.revision },
    {
      $setOnInsert: {
        user: note.user,
        note: note._id,
        revision: note.revision,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        isPinned: Boolean(note.isPinned),
        isFavorite: Boolean(note.isFavorite),
        deletedAt: note.deletedAt || null,
        operationType,
      },
    },
    { upsert: true },
  );
}

export async function getAllNotes(req, res) {
  // send the notes
  // res.status(200).send("You just fetched the notes");
  try {
    const notes = await Note.find(
      await accessibleNotesFilter(req.user._id),
    ).sort({ updatedAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes:", error.message);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
}

export async function getSelectionById(req, res) {
  // find note by id and send it
  try {
    const access = await getNoteAccess(req.params.id, req.user._id);
    const findNote = access?.note;
    if (!findNote) return res.status(404).json({ message: "Note not found" });

    res.status(200).json(findNote);
  } catch (error) {
    console.error("Error in getSelectionById:", error.message);
    res.status(500).json({ message: "Could not fetch note" });
  }
}

export async function getNoteVersions(req, res) {
  try {
    const access = await getNoteAccess(req.params.id, req.user._id);
    const note = access?.note;
    if (!note) return res.status(404).json({ message: "Note not found" });
    const versions = await NoteVersion.find({ note: note._id })
      .sort({ revision: -1 })
      .limit(100)
      .select(
        "revision title content tags isPinned isFavorite deletedAt operationType createdAt updatedAt",
      );
    res.status(200).json(versions);
  } catch (error) {
    console.error("Error in getNoteVersions:", error.message);
    res.status(500).json({ message: "Could not fetch note history" });
  }
}

export async function restoreNoteVersion(req, res) {
  try {
    const baseRevision = baseRevisionFrom(req);
    const restore = async () => {
      const access = await getNoteAccess(req.params.id, req.user._id);
      const note = access?.note;
      if (!note) return { status: 404, body: { message: "Note not found" } };
      if (baseRevision !== undefined && note.revision !== baseRevision) {
        return {
          status: 409,
          body: {
            code: "REVISION_CONFLICT",
            message: "The note changed elsewhere",
            serverNote: note,
          },
        };
      }
      if (access.role !== "owner" && access.role !== "editor")
        return {
          status: 403,
          body: { message: "You do not have permission for this note" },
        };
      const version = await NoteVersion.findOne({
        _id: req.params.versionId,
        note: note._id,
      });
      if (!version)
        return { status: 404, body: { message: "Version not found" } };
      await saveVersion(note, "RESTORE_VERSION");
      const updatedNote = await Note.findOneAndUpdate(
        { _id: note._id, user: req.user._id, revision: note.revision },
        {
          $set: {
            title: version.title,
            content: version.content,
            tags: version.tags,
            isPinned: version.isPinned,
            isFavorite: version.isFavorite,
            deletedAt: version.deletedAt || null,
          },
          $inc: { revision: 1 },
        },
        { new: true, runValidators: true },
      );
      if (!updatedNote)
        return {
          status: 409,
          body: {
            code: "REVISION_CONFLICT",
            message: "The note changed elsewhere",
            serverNote: await Note.findById(note._id),
          },
        };
      return { status: 200, body: updatedNote };
    };
    const result = await runIdempotentMutation(req, res, restore);
    if (result?.status === 409 && result.body?.code === "REVISION_CONFLICT")
      return result;
    return result;
  } catch (error) {
    console.error("Error in restoreNoteVersion:", error.message);
    res.status(500).json({ message: "Could not restore note version" });
  }
}

export async function createNote(req, res) {
  // create a new note
  try {
    const {
      title,
      content,
      tags = [],
      clientNoteId,
      isPinned,
      isFavorite,
    } = req.body;
    const create = async () => {
      if (clientNoteId) {
        const existing = await Note.findOne({
          user: req.user._id,
          clientNoteId,
        });
        if (existing) return { status: 200, body: existing };
      }

      const note = new Note({
        user: req.user._id,
        title,
        content,
        tags: normalizeTags(tags),
        clientNoteId: clientNoteId || null,
        isPinned: Boolean(isPinned),
        isFavorite: Boolean(isFavorite),
      });

      const savedNote = await note.save();
      return { status: 201, body: savedNote };
    };

    await runIdempotentMutation(req, res, create);
  } catch (error) {
    console.error("Error in createNote:", error.message);
    res.status(500).json({ message: "Could not create note" });
  }
}

export async function updateNote(req, res) {
  // update the note with the given id
  try {
    const { title, content, tags, isPinned, isFavorite } = req.body;
    const baseRevision = baseRevisionFrom(req);
    const updates = { title, content };
    if (tags !== undefined) updates.tags = normalizeTags(tags);
    if (isPinned !== undefined) updates.isPinned = Boolean(isPinned);
    if (isFavorite !== undefined) updates.isFavorite = Boolean(isFavorite);
    const update = async () => {
      const filter = { _id: req.noteAccess.note._id };
      addRevisionFilter(filter, baseRevision);
      const currentNote = await Note.findOne(filter);
      if (!currentNote) {
        const existingNote = await Note.findById(req.noteAccess.note._id);
        if (!existingNote)
          return { status: 404, body: { message: "Note not found" } };
        return {
          status: 409,
          body: {
            code: "REVISION_CONFLICT",
            message: "The note changed elsewhere",
            serverNote: existingNote,
          },
        };
      }
      await saveVersion(currentNote, "UPDATE_NOTE");
      const updatedNote = await Note.findOneAndUpdate(
        filter,
        { $set: updates, $inc: { revision: 1 } },
        { new: true, runValidators: true },
      );
      if (updatedNote) {
        await writeAudit({
          actor: req.user._id,
          note: updatedNote._id,
          action: "note.updated",
          metadata: { revision: updatedNote.revision },
        });
        await writeCollaborationEvent({
          actor: req.user._id,
          note: updatedNote._id,
          type: "note.updated",
          revision: updatedNote.revision,
        });
        return { status: 200, body: updatedNote };
      }

      const existingNoteAfter = await Note.findOne({
        _id: req.noteAccess.note._id,
      });
      if (!existingNoteAfter)
        return { status: 404, body: { message: "Note not found" } };
      if (baseRevision !== undefined) {
        return {
          status: 409,
          body: {
            code: "REVISION_CONFLICT",
            message: "The note changed elsewhere",
            serverNote: existingNoteAfter,
          },
        };
      }
      return { status: 404, body: { message: "Note not found" } };
    };

    const operationId = operationIdFrom(req);
    if (operationId) {
      const result = await runIdempotentMutation(req, res, update);
      if (result?.status === 409 && result.body?.code === "REVISION_CONFLICT")
        return result;
      return result;
    }
    const result = await update();
    if (result.status === 409)
      return conflictResponse(res, result.body.serverNote);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error in updateNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}

export async function deleteNote(req, res) {
  // delete the note with the given id
  try {
    const baseRevision = baseRevisionFrom(req);
    const remove = async () => {
      const filter = { _id: req.noteAccess.note._id };
      addRevisionFilter(filter, baseRevision);
      const deletedNote = await Note.findOneAndUpdate(
        filter,
        { $set: { deletedAt: new Date() }, $inc: { revision: 1 } },
        { new: true },
      );
      if (deletedNote) {
        await saveVersion(deletedNote, "DELETE_NOTE");
        await writeAudit({
          actor: req.user._id,
          note: deletedNote._id,
          action: "note.deleted",
          metadata: { revision: deletedNote.revision },
        });
        await writeCollaborationEvent({
          actor: req.user._id,
          note: deletedNote._id,
          type: "note.deleted",
          revision: deletedNote.revision,
        });
        return { status: 200, body: deletedNote };
      }
      const currentNote = await Note.findOne({ _id: req.noteAccess.note._id });
      if (!currentNote)
        return { status: 404, body: { message: "Note not found" } };
      if (baseRevision !== undefined && currentNote.revision !== baseRevision)
        return {
          status: 409,
          body: {
            code: "REVISION_CONFLICT",
            message: "The note changed elsewhere",
            serverNote: currentNote,
          },
        };
      return { status: 404, body: { message: "Note not found" } };
    };
    if (operationIdFrom(req)) return runIdempotentMutation(req, res, remove);
    const result = await remove();
    if (result.status === 409)
      return conflictResponse(res, result.body.serverNote);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error in deleteNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}

export async function getTrash(req, res) {
  try {
    const notes = await Note.find({
      user: req.user._id,
      deletedAt: { $ne: null },
    }).sort({ deletedAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getTrash:", error.message);
    res.status(500).json({ error: "Failed to fetch trash" });
  }
}

export async function restoreNote(req, res) {
  try {
    const baseRevision = baseRevisionFrom(req);
    const restore = async () => {
      const filter = { _id: req.noteAccess.note._id };
      addRevisionFilter(filter, baseRevision);
      const note = await Note.findOneAndUpdate(
        filter,
        { $set: { deletedAt: null }, $inc: { revision: 1 } },
        { new: true },
      );
      if (note) {
        await saveVersion(note, "RESTORE_NOTE");
        await writeAudit({
          actor: req.user._id,
          note: note._id,
          action: "note.restored",
          metadata: { revision: note.revision },
        });
        await writeCollaborationEvent({
          actor: req.user._id,
          note: note._id,
          type: "note.restored",
          revision: note.revision,
        });
        return { status: 200, body: note };
      }
      const currentNote = await Note.findOne({ _id: req.noteAccess.note._id });
      if (!currentNote)
        return { status: 404, body: { message: "Note not found" } };
      return {
        status: 409,
        body: {
          code: "REVISION_CONFLICT",
          message: "The note changed elsewhere",
          serverNote: currentNote,
        },
      };
    };
    return runIdempotentMutation(req, res, restore);
  } catch (error) {
    console.error("Error in restoreNote:", error.message);
    res.status(500).json({ error: "Failed to restore note" });
  }
}

export async function permanentlyDeleteNote(req, res) {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      user: req.user._id,
      deletedAt: { $ne: null },
    });
    if (!note)
      return res.status(404).json({ message: "Trashed note not found" });
    await deleteAttachmentsForNote(note._id, req.user._id);
    await note.deleteOne();
    res.status(200).json({ message: "Note permanently deleted" });
  } catch (error) {
    console.error("Error in permanentlyDeleteNote:", error.message);
    res.status(500).json({ error: "Failed to permanently delete note" });
  }
}

export async function emptyTrash(req, res) {
  try {
    const notes = await Note.find({
      user: req.user._id,
      deletedAt: { $ne: null },
    }).select("_id");
    await Promise.all(
      notes.map((note) => deleteAttachmentsForNote(note._id, req.user._id)),
    );
    await Note.deleteMany({ user: req.user._id, deletedAt: { $ne: null } });
    res.status(200).json({ message: "Trash emptied" });
  } catch (error) {
    console.error("Error in emptyTrash:", error.message);
    res.status(500).json({ error: "Failed to empty trash" });
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [
    ...new Set(
      tags
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 10);
}
