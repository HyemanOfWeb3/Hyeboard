import { Link } from "react-router"
import { Command, Menu, PlusIcon, Search } from "lucide-react"

const Navbar = ({ onSearch, onNewNote, onMenu }) => {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
        <div className="flex items-center justify-between">


          <h1 className="brand-mark">
            HyeBoard
          </h1>


          <div className="header-actions">
            <button className="search-trigger" onClick={onSearch}><Search size={17} /><span>Search notes</span><kbd><Command size={12} />K</kbd></button>
            <Link to={"/create"} onClick={onNewNote} className="primary-button" >
              <PlusIcon className="size-5" />
              <span>New Note</span>
            </Link>

          </div>
        </div>

      </div>

    </header>
  );
}

export default Navbar
