import { createElement, useEffect, useState } from "react";
import {
  Brain,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Sparkles,
  Tags,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router";
import api from "../lib/axios";

const actions = [
  ["summarize", "Summarize", Sparkles],
  ["keyPoints", "Key points", ListChecks],
  ["suggestTags", "Suggest tags", Tags],
  ["related", "Find related notes", Lightbulb],
  ["cleanUp", "Clean up", Sparkles],
  ["checklist", "Make checklist", ListChecks],
  ["titleTags", "Suggest title and tags", Tags],
];

const AIInsightsPanel = ({ noteId, open, onOpenChange, requestedAction, onRequestedActionHandled }) => {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [activeKind, setActiveKind] = useState("");
  const [error, setError] = useState("");

  const run = async (kind) => {
    if (!navigator.onLine) {
      setError(
        "AI features require a connection. Your note remains available offline.",
      );
      return;
    }
    setActiveKind(kind);
    setError("");
    try {
      const response = await api.post(
        `/ai/notes/${encodeURIComponent(noteId)}/${kind}`,
      );
      setResult(response.data);
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        "AI is temporarily unavailable.";
      setError(message);
      toast.error(message);
    } finally {
      setActiveKind("");
    }
  };

  useEffect(() => {
    if (!requestedAction) return;
    onOpenChange?.(true);
    void run(requestedAction);
    onRequestedActionHandled?.();
    // The request token intentionally controls this one-shot action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAction]);

  return (
    <section className={`ai-insights-panel ${open ? "ai-insights-panel--open" : ""}`} aria-label="Optional AI note insights">
      <button className="ai-trigger" onClick={() => onOpenChange?.(!open)} aria-expanded={open}>
        <Brain size={15} /> <span>AI</span><small>{open ? "Close" : "Optional note help"}</small>
      </button>
      {!open ? null : <>
      <div className="ai-insights-panel__header">
        <div>
          <span className="eyebrow">
            <Brain size={13} /> Optional AI
          </span>
          <small>
            Only this note is analyzed. Output may be incomplete; suggestions
            never change your note automatically.
          </small>
        </div>
      </div>
      <div className="ai-insights-panel__actions">
        {actions.map(([kind, label, Icon]) => (
          <button
            key={kind}
            className="focus-toggle"
            onClick={() => run(kind)}
            disabled={Boolean(activeKind)}
          >
            {createElement(Icon, { size: 14 })}
            {activeKind === kind ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              label
            )}
          </button>
        ))}
      </div>
      {error && <p className="ai-insights-panel__message">{error}</p>}
      {result && (
        <div className="ai-insights-result">
          {result.summary && (
            <div>
              <span className="eyebrow">Summary</span>
              <p>{result.summary}</p>
            </div>
          )}
          {result.keyPoints?.length > 0 && (
            <div>
              <span className="eyebrow">Key points</span>
              <ul>
                {result.keyPoints.map((point, index) => (
                  <li key={`${point}-${index}`}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {result.tags?.length > 0 && (
            <div>
              <span className="eyebrow">Suggested tags</span>
              <div className="ai-tag-list">
                {result.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            </div>
          )}
          {result.content && <div><span className="eyebrow">Preview</span><p>{result.content}</p></div>}
          {result.items?.length > 0 && <div><span className="eyebrow">Checklist</span><ul>{result.items.map((item, index) => <li key={`${item}-${index}`}>- [ ] {item}</li>)}</ul></div>}
          {result.title && <div><span className="eyebrow">Suggested title</span><p>{result.title}</p></div>}
          {result.suggestions?.length > 0 && (
            <div>
              <span className="eyebrow">Possible connections</span>
              <div className="ai-related-list">
                {result.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.candidateId}
                    onClick={() =>
                      navigate(
                        `/note/${encodeURIComponent(suggestion.candidateId)}`,
                      )
                    }
                  >
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.reason}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {result.suggestions && result.suggestions.length === 0 && (
            <p className="ai-insights-panel__message">
              No related existing notes suggested.
            </p>
          )}
        </div>
      )}</>}
    </section>
  );
};

export default AIInsightsPanel;
