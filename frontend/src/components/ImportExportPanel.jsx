import { useRef, useState } from "react";
import { Download, FileInput, Upload, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { getLocalNotesForUser } from "../lib/localNotesStore";
import { importNotesLocally } from "../lib/noteMutations";
import {
  createBackup,
  createMarkdown,
  downloadText,
  parseImportText,
} from "../lib/dataPortability";

const ImportExportPanel = ({ userId, onComplete }) => {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState("copy");
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const exportNotes = async (format) => {
    try {
      const { notes, trash } = await getLocalNotesForUser(userId);
      if (format === "json") {
        downloadText("hyeboard-backup.json", JSON.stringify(createBackup(notes, trash), null, 2), "application/json");
      } else {
        downloadText("hyeboard-notes.md", createMarkdown(notes), "text/markdown");
      }
      toast.success(format === "json" ? "Backup exported" : "Markdown exported");
    } catch {
      toast.error("Could not export locally available notes");
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setProgress({ current: 0, total: 0 });
    try {
      const text = await file.text();
      const records = parseImportText(text, file.name);
      setProgress({ current: 0, total: records.length });
      const result = await importNotesLocally(userId, records, {
        duplicateMode,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      await onComplete?.();
      toast.success(`${result.imported.length} note${result.imported.length === 1 ? "" : "s"} imported${result.skipped.length ? `, ${result.skipped.length} skipped` : ""}`);
    } catch (error) {
      toast.error(error.message || "Could not import this file");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="portability-panel">
      <button className="filter-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Download size={15} /> <span>Import / export</span>
      </button>
      {open && <section className="portability-popover" aria-label="Import and export notes">
        <div className="portability-popover__header"><div><strong>Data portability</strong><small>Exports use notes available on this device.</small></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close portability menu"><X size={16} /></button></div>
        <div className="portability-actions"><button className="text-button" onClick={() => exportNotes("json")}><Download size={14} /> Full JSON backup</button><button className="text-button" onClick={() => exportNotes("markdown")}><Download size={14} /> Markdown notes</button><small className="portability-note">Attachments are independent stored assets and are not embedded in note exports.</small></div>
        <div className="portability-import"><label htmlFor="import-duplicates">When a matching note exists</label><select id="import-duplicates" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value)}><option value="copy">Create a copy</option><option value="skip">Skip duplicate</option></select><button className="primary-button" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15} /> {busy ? "Importing..." : "Choose file"}</button><input ref={inputRef} type="file" accept=".json,.md,.markdown,application/json,text/markdown" onChange={importFile} hidden /></div>
        {progress && <div className="portability-progress" role="status"><FileInput size={14} /> {progress.total ? `Importing ${progress.current} of ${progress.total}` : "Reading file..."}</div>}
      </section>}
    </div>
  );
};

export default ImportExportPanel;
