import Note from "../models/Note.js";
import mongoose from "mongoose";
import { AI_MAX_RELATED_CANDIDATES } from "../config/ai.js";
import {
  answerKnowledgeQuestion,
  generateNoteInsight,
} from "../services/aiService.js";
import { rankNotes, searchTokens } from "../services/retrievalService.js";
import {
  accessibleNotesFilter,
  getNoteAccess,
} from "../services/collaborationService.js";

const AI_KINDS = new Set(["summarize", "suggestTags", "keyPoints", "related", "cleanUp", "checklist", "titleTags"]);

function noteFilter(noteId, userId) {
  return {
    user: userId,
    deletedAt: null,
    ...(mongoose.isValidObjectId(noteId)
      ? { _id: noteId }
      : { clientNoteId: noteId }),
  };
}

function errorResponse(error) {
  const map = {
    AI_NOT_CONFIGURED: [503, "AI is not configured"],
    AI_PROVIDER_AUTH: [502, "AI provider authentication failed"],
    AI_MODEL_NOT_FOUND: [503, "AI model configuration is invalid"],
    AI_PROVIDER_REQUEST: [400, "AI provider rejected the request"],
    AI_PROVIDER_ERROR: [502, "AI provider is unavailable"],
    AI_RATE_LIMIT: [429, "AI provider rate limit reached"],
    AI_TIMEOUT: [504, "AI provider timed out"],
    AI_EMPTY_NOTE: [400, "This note has no content to analyze"],
    AI_CONTENT_TOO_LARGE: [413, "This note is too large for AI analysis"],
    AI_BAD_REQUEST: [400, "Unsupported AI operation"],
  };
  const [status, message] = map[error.code] || [
    502,
    "AI could not complete the request",
  ];
  return { status, message };
}

export async function noteInsight(req, res) {
  const { kind } = req.params;
  if (!AI_KINDS.has(kind))
    return res.status(400).json({ message: "Unsupported AI operation" });
  try {
    const access = await getNoteAccess(req.params.noteId, req.user._id);
    const note = access?.note;
    if (!note) return res.status(404).json({ message: "Note not found" });
    let candidates = [];
    if (kind === "related") {
      const accessible = await accessibleNotesFilter(req.user._id);
      candidates = await Note.find({ ...accessible, _id: { $ne: note._id } })
        .select("_id title tags content")
        .sort({ updatedAt: -1 })
        .limit(AI_MAX_RELATED_CANDIDATES)
        .lean();
      candidates = candidates.map((candidate, index) => ({
        ...candidate,
        id: `candidate_${index}`,
        realId: candidate._id.toString(),
      }));
    }
    const result = await generateNoteInsight({ kind, note, candidates });
    const response = { kind, ...result };
    if (kind === "related") {
      const byId = new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
      );
      response.suggestions = result.suggestions.map((suggestion) => ({
        candidateId: byId.get(suggestion.candidateId)?.realId,
        title: byId.get(suggestion.candidateId)?.title || "Untitled note",
        reason: suggestion.reason,
      }));
    }
    res.json(response);
  } catch (error) {
    const { status, message } = errorResponse(error);
    if (status >= 500) console.error("AI insight failed:", error.message);
    res.status(status).json({ message });
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function askKnowledge(req, res) {
  try {
    const question =
      typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > 1_000)
      return res
        .status(400)
        .json({ message: "Ask a question up to 1,000 characters" });
    const tokens = searchTokens(question);
    const query = await accessibleNotesFilter(req.user._id);
    if (tokens.length)
      query.$or = tokens.flatMap((token) => {
        const expression = new RegExp(escapeRegex(token), "i");
        return [
          { title: expression },
          { tags: expression },
          { content: expression },
        ];
      });
    const notes = await Note.find(query)
      .select("_id title content tags updatedAt")
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();
    const ranked = rankNotes(notes, question, 8);
    const sources = ranked.map(({ note }) => ({
      id: note._id.toString(),
      title: note.title || "Untitled note",
      tags: note.tags || [],
      excerpt: String(note.content || "").slice(0, 2_000),
      updatedAt: note.updatedAt,
    }));
    const result = await answerKnowledgeQuestion({ question, sources });
    const sourceByKey = new Map(
      result.sourceKeys.map((key, index) => [key, sources[index]]),
    );
    res.json({
      answer: result.answer,
      uncertainty: result.uncertainty,
      cached: result.cached,
      sources: result.sourceKeys
        .map((key) => sourceByKey.get(key))
        .filter(Boolean),
    });
  } catch (error) {
    const { status, message } = errorResponse(error);
    if (status >= 500) console.error("AI assistant failed:", error.message);
    res.status(status).json({ message });
  }
}
