import { Link } from "react-router";
import {
  Command,
  LogOut,
  Menu,
  PlusIcon,
  Search,
  Brain,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/useAuth";

const Navbar = ({ onSearch, onNewNote, onMenu, onAssistant, mobileOpen }) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button
          className="mobile-menu icon-button"
          onClick={onMenu}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center justify-between">
          <h1 className="brand-mark">HyeBoard</h1>

          <div className="header-actions">
            <button className="search-trigger" onClick={onSearch}>
              <Search size={17} />
              <span>Search notes</span>
              <kbd>
                <Command size={12} />K
              </kbd>
            </button>
            <button
              className="icon-button"
              onClick={onAssistant}
              aria-label="Open knowledge assistant"
              title="Ask your notes"
            >
              <Brain size={18} />
            </button>
            <Link to={"/create"} onClick={onNewNote} className="primary-button">
              <PlusIcon className="size-5" />
              <span>New Note</span>
            </Link>
            <div className="account-menu">
              <button
                className="icon-button account-trigger"
                onClick={() => setOpen((value) => !value)}
                aria-label="Open account menu"
                aria-expanded={open}
              >
                <UserRound size={18} />
              </button>
              {open && (
                <div className="account-popover">
                  <strong>{user?.email}</strong>
                  <button disabled>
                    <UserRound size={15} /> Profile
                  </button>
                  <button disabled>
                    <span className="account-dot" /> Settings
                  </button>
                  <button
                    onClick={() => {
                      void logout();
                      window.location.assign("/login");
                    }}
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
