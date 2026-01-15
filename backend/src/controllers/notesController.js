import Note from "../models/Note.js";

export async function getAllNotes(req, res) {
  // send the notes
  // res.status(200).send("You just fetched the notes");
  try {
    const notes = await Note.find().sort({ createdAt: -1 }); // sort the notes by createdAt in descending order
    res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes:", error.message);
    res.status(500).json({ error: "Failed to fetch notes", message: error.message });
  }
}

export async function getSelectionById(req, res) {
  // find note by id and send it
  try {
    const findNote = await Note.findById(req.params.id);
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
    const { title, content } = req.body;
    const note = new Note({ title, content });

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
    const { title, content } = req.body;
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { title, content },
      { new: true }
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
    const deletedNote = await Note.findByIdAndDelete(req.params.id);
    if (!deletedNote)
      return res.status(404).json({ message: "Note not found" });

    res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error in deleteNote:", error);
    res.status(500).json({ message: "Internal Server Error!" });
  }
}
