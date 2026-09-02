import Note from "../models/Note.js";

export async function getAllNotes(req, res) {
  // send the notes
  // res.status(200).send("You just fetched the notes");
  try {
    const notes = await Note.find({ deletedAt: null }).sort({ updatedAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch notes", message: error.message });
  }
}

export async function getSelectionById(req, res) {
  // find note by id and send it
  try {
    const findNote = await Note.findOne({ _id: req.params.id, deletedAt: null });
    if (!findNote) return res.status(404).json({ message: "Note not found" });

    res.status(200).json(findNote);
  } catch (error) {
    console.error("Error in getSelectionById:", error);
    res.status(500).json({ message: "Note not found!" });
  }
}

export async function createNote(req, res) {
  // create a new note
  try {
    const { title, content, tags = [] } = req.body;
    const note = new Note({ title, content, tags: normalizeTags(tags) });

    //This will display the status message
    // await newNote.save();
    // res.status(201).json({ message: "Note created successfully" });

    //This will display the created note
    const savedNote = await note.save();
    res.status(201).json(savedNote);
  } catch (error) {
    console.error("Error in createNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}

export async function updateNote(req, res) {
  // update the note with the given id
  try {
    const { title, content, tags, isPinned, isFavorite } = req.body;
    const updates = { title, content };
    if (tags !== undefined) updates.tags = normalizeTags(tags);
    if (isPinned !== undefined) updates.isPinned = Boolean(isPinned);
    if (isFavorite !== undefined) updates.isFavorite = Boolean(isFavorite);
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );
    if (!updatedNote)
      return res.status(404).json({ message: "Note not found" });

    res.status(200).json(updatedNote);
  } catch (error) {
    console.error("Error in updateNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}

export async function deleteNote(req, res) {
  // delete the note with the given id
  try {
    const deletedNote = await Note.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!deletedNote)
      return res.status(404).json({ message: "Note not found" });

    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error in deleteNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}

export async function getTrash(req, res) {
  try {
    const notes = await Note.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getTrash:", error.message);
    res.status(500).json({ error: "Failed to fetch trash" });
  }
}

export async function restoreNote(req, res) {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true },
    );
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.status(200).json(note);
  } catch (error) {
    console.error("Error in restoreNote:", error.message);
    res.status(500).json({ error: "Failed to restore note" });
  }
}

export async function permanentlyDeleteNote(req, res) {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } });
    if (!note) return res.status(404).json({ message: "Trashed note not found" });
    res.status(200).json({ message: "Note permanently deleted" });
  } catch (error) {
    console.error("Error in permanentlyDeleteNote:", error.message);
    res.status(500).json({ error: "Failed to permanently delete note" });
  }
}

export async function emptyTrash(req, res) {
  try {
    await Note.deleteMany({ deletedAt: { $ne: null } });
    res.status(200).json({ message: "Trash emptied" });
  } catch (error) {
    console.error("Error in emptyTrash:", error.message);
    res.status(500).json({ error: "Failed to empty trash" });
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean))].slice(0, 10);
}
