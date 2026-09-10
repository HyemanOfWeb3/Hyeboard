import { useState } from "react";
import { Brain, ExternalLink, LoaderCircle, Send, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Link } from "react-router";
import api from "../lib/axios";

const KnowledgeAssistant = ({ open, onClose }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (!navigator.onLine) {
      toast.error("The knowledge assistant requires a connection.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/ai/ask", { question: question.trim() });
      setAnswer(response.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "The knowledge assistant is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div
      className="assistant-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="assistant-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge assistant"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="assistant-panel__header">
          <div>
            <span className="eyebrow">
              <Brain size={14} /> Your notes
            </span>
            <h2>Knowledge assistant</h2>
            <p>Answers use matching notes from your workspace only.</p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close knowledge assistant"
          >
            <X size={18} />
          </button>
        </header>
        <form className="assistant-form" onSubmit={ask}>
          <textarea
            value={question}
            onChange={(event) =>
              setQuestion(event.target.value.slice(0, 1_000))
            }
            placeholder="Ask about your notes..."
            aria-label="Question"
            maxLength={1_000}
          />
          <button
            className="primary-button"
            disabled={loading || !question.trim()}
          >
            {loading ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Send size={15} />
            )}{" "}
            {loading ? "Searching notes..." : "Ask"}
          </button>
        </form>
        {answer && (
          <div className="assistant-answer">
            <span className="eyebrow">Answer</span>
            <p>{answer.answer}</p>
            {answer.uncertainty && (
              <small className="assistant-answer__uncertainty">
                {answer.uncertainty}
              </small>
            )}
            <div className="assistant-sources">
              <span className="eyebrow">Based on</span>
              {answer.sources?.length ? (
                answer.sources.map((source) => (
                  <Link
                    key={source.id}
                    to={`/note/${encodeURIComponent(source.id)}`}
                    onClick={onClose}
                  >
                    <span>{source.title}</span>
                    <ExternalLink size={13} />
                  </Link>
                ))
              ) : (
                <small>No matching notes were found.</small>
              )}
            </div>
          </div>
        )}
        <small className="assistant-disclaimer">
          AI interpretation may be incomplete. It does not edit notes or create
          links.
        </small>
      </section>
    </div>
  );
};

export default KnowledgeAssistant;
