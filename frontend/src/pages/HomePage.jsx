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
        console.error(
          "Error fetching notes:",
          error.response?.data || error.message
        );
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else {
          const errorMsg =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Failed to load notes";
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
    <div className="min-h-screen">
      <Navbar />

      {isRateLimited && <RateLimitedUI />}

      <div className="max-w-7xl mx-auto p-4 mt-6">
        {loading && (
          <div className="text-center text-primary py-10">
            Loading notes....
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-10">
            <p className="text-error text-lg">{error}</p>
            <p className="text-sm mt-4">
              Check browser console for more details.
            </p>
          </div>
        )}

        {!loading && !error && notes.length === 0 && !isRateLimited && (
          <NotesNotFound />
        )}

        {!loading && !error && notes.length > 0 && !isRateLimited && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
