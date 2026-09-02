import { NotebookIcon } from "lucide-react";
import { Link } from "react-router";

const NotesNotFound = ({ isSearch = false, isTrash = false }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-md mx-auto text-center">
      <div className="bg-primary/10 rounded-full p-8">
        <NotebookIcon className="size-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold">{isSearch ? "No notes found" : isTrash ? "Trash is empty" : "No notes yet"}</h3>
      <p className="text-base-content/70">
        {isSearch ? "Try another search or clear your filters." : isTrash ? "Deleted notes will appear here before they are permanently removed." : "Capture an idea, a plan, or anything worth remembering."}
      </p>
      {!isSearch && !isTrash && <Link to="/create" className="btn btn-primary">Create Your First Note</Link>}
    </div>
  );
};

export default NotesNotFound;
