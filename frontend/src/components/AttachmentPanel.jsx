import { useCallback, useEffect, useRef, useState } from "react";
import { Download, File, Image, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../lib/axios";

const AttachmentPanel = ({ noteId }) => {
  const inputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState("idle");
  const [offline, setOffline] = useState(!navigator.onLine);

  const loadAttachments = useCallback(async () => {
    if (!navigator.onLine) {
      setOffline(true);
      setStatus("offline");
      return;
    }
    try {
      const response = await api.get(`/attachments/note/${encodeURIComponent(noteId)}`);
      setAttachments(response.data || []);
      setOffline(false);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [noteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadAttachments(), 0);
    const goOnline = () => { setOffline(false); loadAttachments(); };
    const goOffline = () => { setOffline(true); setStatus("offline"); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, [loadAttachments]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!navigator.onLine) { toast.error("Attachments require a connection"); return; }
    setStatus("uploading");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await api.post(`/attachments/note/${encodeURIComponent(noteId)}`, formData);
      setAttachments((current) => [response.data, ...current]);
      setStatus("idle");
      toast.success("Attachment uploaded");
    } catch (error) {
      setStatus("error");
      toast.error(error.response?.data?.message || "Could not upload attachment");
    }
  };

  const remove = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.filename}?`)) return;
    try {
      await api.delete(`/attachments/${encodeURIComponent(attachment._id)}`);
      setAttachments((current) => current.filter((item) => item._id !== attachment._id));
      toast.success("Attachment deleted");
    } catch {
      toast.error("Could not delete attachment");
    }
  };

  return <section className="attachment-panel" aria-label="Note attachments">
    <div className="attachment-panel__header"><div><span className="eyebrow">Attachments</span><small>{offline ? "Available after reconnecting" : `${attachments.length} of 10 · 4 MB maximum each`}</small></div><button className="focus-toggle" onClick={() => inputRef.current?.click()} disabled={offline || status === "uploading"}><Upload size={15} /> {status === "uploading" ? "Uploading..." : "Add file"}</button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv" onChange={upload} hidden /></div>
    {status === "error" && <p className="attachment-panel__message">Attachments are temporarily unavailable.</p>}
    {status === "offline" && <p className="attachment-panel__message">Large files are not stored in the offline note queue. Reconnect to upload or view attachments.</p>}
    {attachments.length > 0 && <div className="attachment-list">{attachments.map((attachment) => <article className="attachment-item" key={attachment._id}><div className="attachment-item__icon">{attachment.mimeType.startsWith("image/") ? <Image size={17} /> : attachment.mimeType === "application/pdf" ? <File size={17} /> : <Paperclip size={17} />}</div><div className="attachment-item__details"><strong title={attachment.filename}>{attachment.filename}</strong><small>{attachment.mimeType} · {(attachment.size / 1024).toFixed(0)} KB</small></div><a className="icon-button" href={attachment.url} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.filename}`}><Download size={16} /></a><button className="icon-button icon-button--danger" onClick={() => remove(attachment)} aria-label={`Delete ${attachment.filename}`}><Trash2 size={16} /></button></article>)}</div>}
  </section>;
};

export default AttachmentPanel;
