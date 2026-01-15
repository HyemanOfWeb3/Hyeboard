import { useState } from "react";
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import { useEffect } from "react";
import api from "../lib/axios";
import { toast } from "react-hot-toast";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";

const HomePage = () => {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        console.log("Fetching notes from API...");
        const res = await api.get("/notes");
        console.log("Notes fetched successfully:", res.data);
        setNotes(Array.isArray(res.data) ? res.data : []);
        setIsRateLimited(false);
        setError(null);
      } catch (error) {
        console.error("Full error object:", error);
        console.error(
          "Error fetching notes:",
          error.response?.data || error.message
        );
        if (error.response?.status === 429) {
          setIsRateLimited(true);
          setError("Too many requests. Please try again later.");
        } else {
          const errorMsg =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Failed to load notes";
          console.log("Setting error to:", errorMsg);
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />

      {isRateLimited && <RateLimitedUI />}

      <div className="max-w-7xl mx-auto p-4 mt-6">
        {/* Always show something */}
        {loading && (
          <div className="alert alert-info">
            <span>Loading notes....</span>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && notes.length === 0 && !isRateLimited && (
          <div className="alert alert-warning">
            <span>No notes found. Create your first note!</span>
          </div>
        )}

        {!loading && !error && notes.length > 0 && !isRateLimited && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {notes.map((note) => (
              <NoteCard key={note._id} note={note} setNotes={setNotes} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
