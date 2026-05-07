import { useEffect, useState, useRef } from "react";
import { useAppStore } from "./store/appStore";
import "./styles.css";

export default function App() {
  const { loadData, inventories, playbooks, groups, layer2, selectedInventory, selectedPlaybook, limit, status, output, selectInventory, selectPlaybook, setLimit, loadLayer2, execute, kill } = useAppStore();

  useEffect(() => {
    loadData();
  }, []);

  const canExecute = !!(selectedInventory && selectedPlaybook && status !== "running");

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
          groups={groups}
          layer2={layer2}
          limit={limit}
          status={status}
          output={output}
          canExecute={canExecute}
          onLimitChange={setLimit}
          onGroupChange={loadLayer2}
          onExecute={execute}
          onKill={kill}
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

function Terminal({ selectedInventory, selectedPlaybook, groups, layer2, limit, status, output, canExecute, onLimitChange, onGroupChange, onExecute, onKill }: {
  selectedInventory: any;
  selectedPlaybook: any;
  groups: string[];
  layer2: string[];
  limit: string;
  status: string;
  output: any[];
  canExecute: boolean;
  onLimitChange: (limit: string) => void;
  onGroupChange: (group: string) => void;
  onExecute: () => void;
  onKill: () => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const command = selectedInventory && selectedPlaybook 
    ? `ansible-playbook -i ${selectedInventory.name} ${selectedPlaybook.name}${limit ? ` --limit ${limit}` : ''}`
    : '';

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const hasSelection = output.length > 0 || status !== "idle";

  if (!hasSelection) {
    return (
      <div className="terminal">
        <div className="terminal-header">
          <div className="terminal-title">
            <span className="terminal-status-dot terminal-status-dot--idle"></span>
            <span className="terminal-status-text">Ready</span>
          </div>
          <div className="terminal-actions">
            <button className="execute-btn" disabled={!canExecute} onClick={onExecute}>
              <PlayIcon />
              Run
            </button>
          </div>
        </div>
        <div className="terminal-toolbar">
          <div className="limit-input-stack">
            <div className="limit-input-row">
              <select 
                className="limit-select"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    onGroupChange(val);
                    onLimitChange(val);
                  }
                }}
              >
                <option value="">Select group...</option>
                {groups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {layer2.length > 0 && (
                <select 
                  className="limit-select"
                  value={limit}
                  onChange={(e) => onLimitChange(e.target.value)}
                >
                  <option value="">Select host or child...</option>
                  {layer2.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
            {command && <div className="terminal-command-display">{command}</div>}
          </div>
        </div>
        <div className="terminal-content">
          <div className="terminal-empty">Select an inventory and playbook to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className={`terminal-status-dot terminal-status-dot--${status}`}></span>
          <span className="terminal-status-text">
            {status === "running" ? "Running..." : status === "success" ? "Completed" : status === "failed" ? "Failed" : "Ready"}
          </span>
        </div>
        <div className="terminal-actions">
          {status === "running" ? (
            <button className="execute-btn" onClick={onKill} style={{ background: 'var(--red)' }}>
              <StopIcon />
              Stop
            </button>
          ) : (
            <button className="execute-btn" disabled={!canExecute} onClick={onExecute}>
              <PlayIcon />
              Run
            </button>
          )}
        </div>
      </div>
      <div className="terminal-toolbar">
        <div className="limit-input-stack">
          <div className="limit-input-row">
            <select 
              className="limit-select"
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  onGroupChange(val);
                  onLimitChange(val);
                }
              }}
            >
              <option value="">Select group...</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {layer2.length > 0 && (
              <select 
                className="limit-select"
                value={limit}
                onChange={(e) => onLimitChange(e.target.value)}
              >
                <option value="">Select host or child...</option>
                {layer2.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          {command && <div className="terminal-command-display">{command}</div>}
        </div>
      </div>
      <div className="terminal-content" ref={terminalRef}>
        {output.map((line, i) => (
          <div key={i} className={`terminal-line terminal-line--${line.stream}`}>
            {line.line}
          </div>
        ))}
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

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}