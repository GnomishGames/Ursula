import { useEffect, useState, useRef } from "react";
import { useAppStore } from "./store/appStore";
import "./styles.css";

export default function App() {
  const { loadData, inventories, playbooks, selectedInventory, selectedPlaybook, status, output, selectInventory, selectPlaybook, execute, clearOutput } = useAppStore();

  useEffect(() => {
    loadData();
  }, []);

  const canExecute = selectedInventory && selectedPlaybook && status === "idle";

  return (
    <div className="app-root">
      <div className="sidebar">
        <SidebarPanel
          title="Inventories"
          items={inventories}
          selectedItem={selectedInventory}
          onSelect={selectInventory}
        />
        <SidebarPanel
          title="Playbooks"
          items={playbooks}
          selectedItem={selectedPlaybook}
          onSelect={selectPlaybook}
        />
      </div>
      <div className="main-area">
        <Terminal
          selectedInventory={selectedInventory}
          selectedPlaybook={selectedPlaybook}
          status={status}
          output={output}
          canExecute={canExecute}
          onExecute={execute}
          onClear={clearOutput}
        />
      </div>
    </div>
  );
}

function SidebarPanel({ title, items, selectedItem, onSelect }: {
  title: string;
  items: any[];
  selectedItem: any;
  onSelect: (item: any) => void;
}) {
  const [search, setSearch] = useState("");
  
  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span className="app-title">{title}</span>
        <span className="list-section-count">{items.length}</span>
      </div>
      <div className="search-bar">
        <SearchIcon />
        <input
          type="text"
          className="search-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="item-list">
        {filtered.length === 0 ? (
          <div className="empty-list">No {title.toLowerCase()} found</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              className={`item-btn ${selectedItem?.id === item.id ? "item-btn--selected" : ""}`}
              onClick={() => onSelect(item)}
            >
              <div className={`item-icon ${selectedItem?.id === item.id ? "item-icon--selected" : ""}`}>
                {title === "Inventories" ? <ServerIcon /> : <PlaybookIcon />}
              </div>
              <div className="item-info">
                <span className="item-label">{item.name}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Terminal({ selectedInventory, selectedPlaybook, status, output, canExecute, onExecute, onClear }: {
  selectedInventory: any;
  selectedPlaybook: any;
  status: string;
  output: any[];
  canExecute: boolean;
  onExecute: () => void;
  onClear: () => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const isWaiting = !selectedInventory && !selectedPlaybook;

  if (isWaiting) {
    return (
      <div className="terminal-waiting">
        <div className="empty-state">
          <div className="empty-state-inner">
            <div className="empty-logo">
              <span className="logo-bracket">[</span>
              <span className="logo-text">Ursula</span>
              <span className="logo-bracket">]</span>
            </div>
            <p className="empty-hint">Select an inventory and playbook to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-status-dot terminal-status-dot--{status}"></span>
          <span className="terminal-status-text">
            {status === "running" ? "Running..." : status === "success" ? "Completed" : status === "failed" ? "Failed" : "Ready"}
          </span>
        </div>
        <div className="terminal-actions">
          <button className="execute-btn" disabled={!canExecute} onClick={onExecute}>
            <PlayIcon />
            Run
          </button>
          <button className="icon-btn" onClick={onClear}>
            <ClearIcon />
          </button>
        </div>
      </div>
      <div className="terminal-toolbar">
        <span className="terminal-command">
          ansible-playbook -i {selectedInventory?.name} {selectedPlaybook?.name}
        </span>
      </div>
      <div className="terminal-content" ref={terminalRef}>
        {output.length === 0 ? (
          <div className="terminal-empty">Press Run to execute the playbook</div>
        ) : (
          output.map((line, i) => (
            <div key={i} className={`terminal-line terminal-line--${line.stream}`}>
              {line.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function PlaybookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}