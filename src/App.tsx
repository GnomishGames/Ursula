import { useEffect } from "react";
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
      <Sidebar
        inventories={inventories}
        playbooks={playbooks}
        selectedInventory={selectedInventory}
        selectedPlaybook={selectedPlaybook}
        onSelectInventory={selectInventory}
        onSelectPlaybook={selectPlaybook}
      />
      <div className="main-area">
        <ContentArea
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

function Sidebar({ inventories, playbooks, selectedInventory, selectedPlaybook, onSelectInventory, onSelectPlaybook }: {
  inventories: any[];
  playbooks: any[];
  selectedInventory: any;
  selectedPlaybook: any;
  onSelectInventory: (inv: any) => void;
  onSelectPlaybook: (pb: any) => void;
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="app-title">Ursula</span>
      </div>
      <div className="item-list">
        <div className="list-section">
          <button className="list-section-title">
            Inventories
            <span className="list-section-count">{inventories.length}</span>
          </button>
          {inventories.length === 0 ? (
            <div className="empty-list">No inventories found</div>
          ) : (
            inventories.map((inv) => (
              <button
                key={inv.id}
                className={`item-btn ${selectedInventory?.id === inv.id ? "item-btn--selected" : ""}`}
                onClick={() => onSelectInventory(inv)}
              >
                <div className={`item-icon ${selectedInventory?.id === inv.id ? "item-icon--selected" : ""}`}>
                  <ServerIcon />
                </div>
                <div className="item-info">
                  <span className="item-label">{inv.name}</span>
                  <span className="item-sublabel">{inv.path}</span>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="list-section">
          <button className="list-section-title">
            Playbooks
            <span className="list-section-count">{playbooks.length}</span>
          </button>
          {playbooks.length === 0 ? (
            <div className="empty-list">No playbooks found</div>
          ) : (
            playbooks.map((pb) => (
              <button
                key={pb.id}
                className={`item-btn ${selectedPlaybook?.id === pb.id ? "item-btn--selected" : ""}`}
                onClick={() => onSelectPlaybook(pb)}
              >
                <div className={`item-icon ${selectedPlaybook?.id === pb.id ? "item-icon--selected" : ""}`}>
                  <PlaybookIcon />
                </div>
                <div className="item-info">
                  <span className="item-label">{pb.name}</span>
                  <span className="item-sublabel">{pb.path}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ContentArea({ selectedInventory, selectedPlaybook, status, output, canExecute, onExecute, onClear }: {
  selectedInventory: any;
  selectedPlaybook: any;
  status: string;
  output: any[];
  canExecute: boolean;
  onExecute: () => void;
  onClear: () => void;
}) {
  const isWaiting = !selectedInventory && !selectedPlaybook;

  if (isWaiting) {
    return (
      <div className="content-area">
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
    <div className="content-area">
      <div className="selection-panel">
        <div className="selection-row">
          <span className="selection-label">Inventory</span>
          <div className="selection-display">
            <span className="selection-display-label">
              {selectedInventory?.name || "—"}
            </span>
          </div>
        </div>
        <div className="selection-row">
          <span className="selection-label">Playbook</span>
          <div className="selection-display">
            <span className="selection-display-label">
              {selectedPlaybook?.name || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="execute-section">
        <button
          className="execute-btn"
          disabled={!canExecute}
          onClick={onExecute}
        >
          {status === "running" ? (
            <>
              <span className="spinner"></span>
              Running...
            </>
          ) : (
            <>
              <PlayIcon />
              Run Playbook
            </>
          )}
        </button>
      </div>

      {output.length > 0 && (
        <div className="output-panel">
          <div className="output-header">
            <span className="output-title">Output</span>
            <button className="icon-btn" onClick={onClear}>
              <ClearIcon />
            </button>
          </div>
          <div className="output-content">
            {output.map((line, i) => (
              <div key={i} className={`output-line output-line--${line.type}`}>
                {line.line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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