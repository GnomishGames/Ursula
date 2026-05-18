import { useEffect, useState, useRef, useCallback, memo } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useAppStore, THEMES } from "./store/appStore";
import "./styles.css";

export default function App() {
  const { loadData, inventories, playbooks, selectedInventory, selectedPlaybook, limit, status, output, filePreview, selectInventory, selectPlaybook, setLimit, execute, kill, closeFilePreview, config, settingsOpen, loadSettings, toggleSettings, saveSettings, theme, setTheme, updateAvailable, latestVersion, dismissUpdate, checkForUpdate } = useAppStore();

  const [leftWidth, setLeftWidth] = useState(200);
  const [rightWidth, setRightWidth] = useState(200);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const handleMouseDown = (edge: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(edge);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    if (isDragging === "left") {
      setLeftWidth(Math.max(120, Math.min(400, e.clientX)));
    } else if (isDragging === "right") {
      const newRightWidth = e.clientX - leftWidth - 8;
      setRightWidth(Math.max(120, Math.min(400, newRightWidth)));
    }
  }, [isDragging, leftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    loadData();
    loadSettings();
    checkForUpdate();
  }, []);

  const canExecute = !!(selectedInventory && selectedPlaybook && status !== "running");

  return (
    <div className="app-root">
      {settingsOpen && (
        <SettingsPanel
          config={config}
          theme={theme}
          onThemeChange={setTheme}
          onSave={saveSettings}
          onClose={toggleSettings}
          updateAvailable={updateAvailable}
          latestVersion={latestVersion}
          checkForUpdate={checkForUpdate}
        />
      )}
      <div className="app-body">
        <div className="sidebar" style={{ width: leftWidth, flexShrink: 0 }}>
          <SidebarPanel
            title="Inventories"
            items={inventories}
            selectedItem={selectedInventory}
            onSelect={selectInventory}
          />
        </div>
        <div
          className="resize-handle"
          onMouseDown={handleMouseDown("left")}
        />
        <div className="sidebar" style={{ width: rightWidth, flexShrink: 0 }}>
          <SidebarPanel
            title="Playbooks"
            items={playbooks}
            selectedItem={selectedPlaybook}
            onSelect={selectPlaybook}
          />
        </div>
        <div
          className="resize-handle"
          onMouseDown={handleMouseDown("right")}
        />
        <div className="main-area">
          <Terminal
            selectedInventory={selectedInventory}
            selectedPlaybook={selectedPlaybook}
            limit={limit}
            status={status}
            output={output}
            filePreview={filePreview}
            canExecute={canExecute}
            onLimitChange={setLimit}
            onExecute={execute}
            onKill={kill}
            onClosePreview={closeFilePreview}
          />
        </div>
      </div>
      <StatusBar config={config} onSettingsClick={toggleSettings} />
      {updateAvailable && (
        <UpdateNotification version={latestVersion} onUpdate={() => open("https://github.com/GnomishGames/Ursula/releases")} onDismiss={dismissUpdate} />
      )}
    </div>
  );
}

function SettingsPanel({ config, theme, onThemeChange, onSave, onClose, updateAvailable, latestVersion, checkForUpdate }: {
  config: { ansible_dir: string; inventory_dir: string; playbook_dir: string; git_enabled: boolean; git_pull_before_run: boolean } | null;
  theme: string;
  onThemeChange: (id: string) => void;
  onSave: (config: { ansible_dir: string; inventory_dir: string; playbook_dir: string; git_enabled: boolean; git_pull_before_run: boolean }) => void;
  onClose: () => void;
  updateAvailable: boolean;
  latestVersion: string;
  checkForUpdate: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"general" | "git" | "appearance" | "about">("general");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (activeTab === "about") {
      setIsCheckingUpdate(true);
      checkForUpdate().finally(() => setIsCheckingUpdate(false));
    }
  }, [activeTab]);
  const [ansibleDir, setAnsibleDir] = useState(config?.ansible_dir || "");
  const [inventoryDir, setInventoryDir] = useState(config?.inventory_dir || "");
  const [playbookDir, setPlaybookDir] = useState(config?.playbook_dir || "");
  const [gitEnabled, setGitEnabled] = useState(config?.git_enabled ?? false);
  const [gitPullBeforeRun, setGitPullBeforeRun] = useState(config?.git_pull_before_run ?? false);

  useEffect(() => {
    if (config) {
      setAnsibleDir(config.ansible_dir);
      setInventoryDir(config.inventory_dir);
      setPlaybookDir(config.playbook_dir);
      setGitEnabled(config.git_enabled);
      setGitPullBeforeRun(config.git_pull_before_run);
    }
  }, [config]);

  const handleSave = () => {
    onSave({
      ansible_dir: ansibleDir,
      inventory_dir: inventoryDir,
      playbook_dir: playbookDir,
      git_enabled: gitEnabled,
      git_pull_before_run: gitPullBeforeRun,
    });
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="settings-tabs">
          <button
            className={`settings-tab${activeTab === "general" ? " settings-tab--active" : ""}`}
            onClick={() => setActiveTab("general")}
          >General</button>
          <button
            className={`settings-tab${activeTab === "git" ? " settings-tab--active" : ""}`}
            onClick={() => setActiveTab("git")}
          >Git</button>
          <button
            className={`settings-tab${activeTab === "appearance" ? " settings-tab--active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >Appearance</button>
          <button
            className={`settings-tab${activeTab === "about" ? " settings-tab--active" : ""}`}
            onClick={() => setActiveTab("about")}
          >About</button>
        </div>
        {activeTab === "general" && (
          <>
            <div className="settings-content">
              <div className="settings-field">
                <label>Ansible Directory</label>
                <input
                  type="text"
                  value={ansibleDir}
                  onChange={(e) => setAnsibleDir(e.target.value)}
                  placeholder="/path/to/ansible"
                />
              </div>
              <div className="settings-field">
                <label>Inventory Directory</label>
                <input
                  type="text"
                  value={inventoryDir}
                  onChange={(e) => setInventoryDir(e.target.value)}
                  placeholder="/path/to/inventory"
                />
              </div>
              <div className="settings-field">
                <label>Playbook Directory</label>
                <input
                  type="text"
                  value={playbookDir}
                  onChange={(e) => setPlaybookDir(e.target.value)}
                  placeholder="/path/to/playbooks"
                />
              </div>
            </div>
            <div className="settings-footer">
              <button className="settings-cancel" onClick={onClose}>Cancel</button>
              <button className="settings-save" onClick={handleSave}>Save</button>
            </div>
          </>
        )}
        {activeTab === "git" && (
          <>
            <div className="settings-content">
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Enable Git integration</span>
                  <span className="toggle-desc">Allows Ursula to run Git commands in the Ansible directory</span>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={gitEnabled} onChange={(e) => {
                    setGitEnabled(e.target.checked);
                    if (!e.target.checked) setGitPullBeforeRun(false);
                  }} />
                  <span className="toggle-track" />
                </label>
              </div>
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className={`toggle-label${!gitEnabled ? " toggle-label--disabled" : ""}`}>Pull before run</span>
                  <span className="toggle-desc">Run <code className="toggle-code">git pull</code> before every playbook execution</span>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={gitPullBeforeRun} disabled={!gitEnabled} onChange={(e) => setGitPullBeforeRun(e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            <div className="settings-footer">
              <button className="settings-cancel" onClick={onClose}>Cancel</button>
              <button className="settings-save" onClick={handleSave}>Save</button>
            </div>
          </>
        )}
        {activeTab === "appearance" && (
          <div className="settings-content">
            <span className="settings-section-label">Theme</span>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-card${theme === t.id ? " theme-card--selected" : ""}`}
                  onClick={() => onThemeChange(t.id)}
                >
                  <div className="theme-preview">
                    <div style={{ flex: 1, background: t.vars["--bg-surface"] }} />
                    <div style={{ flex: 1, background: t.vars["--bg-elevated"] }} />
                    <div style={{ width: 12, background: t.vars["--accent"] }} />
                    <div style={{ width: 8, background: t.vars["--green"] }} />
                    <div style={{ width: 8, background: t.vars["--red"] }} />
                  </div>
                  <span className="theme-name">{t.name}</span>
                  {theme === t.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeTab === "about" && (
          <div className="settings-content">
            <div className="about-section">
              <h2 className="about-title">Ursula</h2>
              <p className="about-version">v0.2.4</p>
            </div>
            <div className="update-check-section">
              {isCheckingUpdate ? (
                <button className="settings-save" disabled>Checking...</button>
              ) : updateAvailable ? (
                <button className="settings-save" onClick={() => open("https://github.com/GnomishGames/Ursula/releases")}>
                  Update to v{latestVersion}
                </button>
              ) : (
                <button className="settings-save" disabled style={{ opacity: 0.5, cursor: "default" }}>Up to date</button>
              )}
            </div>
          </div>
        )}
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterItems = (items: any[], query: string): any[] => {
    return items.reduce((acc, item) => {
      const matches = item.name.toLowerCase().includes(query.toLowerCase());
      const children = item.children ? filterItems(item.children, query) : [];
      if (matches || children.length > 0) {
        acc.push({ ...item, children });
      }
      return acc;
    }, []);
  };

  const filtered = filterItems(items, search);

  const renderItem = (item: any, depth: number = 0) => {
    const isSelected = selectedItem?.id === item.id && selectedItem?.path === item.path;

    return (
      <div key={item.id + item.path}>
        <button
          className={`item-btn ${isSelected ? "item-btn--selected" : ""}`}
          style={{ paddingLeft: item.is_folder ? `${6 + depth * 20}px` : `${14 + depth * 30}px` }}
          onClick={() => {
            if (item.is_folder) {
              toggleExpand(item.id + item.path);
            } else {
              onSelect(item);
            }
          }}
        >
          {item.is_folder && (
            <span className="folder-toggle">
              {expanded.has(item.id + item.path) ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
          )}
          <div className={`item-icon ${isSelected ? "item-icon--selected" : ""}`}>
            {item.is_folder ? <FolderIcon /> : (title === "Inventories" ? <ServerIcon /> : <PlaybookIcon />)}
          </div>
          <div className="item-info">
            <span className="item-label">{item.name}</span>
          </div>
        </button>
        {item.is_folder && expanded.has(item.id + item.path) && item.children?.map((child: any) => renderItem(child, depth + 1))}
      </div>
    );
  };

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
          filtered.map((item) => renderItem(item))
        )}
      </div>
    </div>
  );
}

function Terminal({ selectedInventory, selectedPlaybook, limit, status, output, filePreview, canExecute, onLimitChange, onExecute, onKill, onClosePreview }: {
  selectedInventory: any;
  selectedPlaybook: any;
  limit: string;
  status: string;
  output: any[];
  filePreview: { name: string; path: string; content: string } | null;
  canExecute: boolean;
  onLimitChange: (limit: string) => void;
  onExecute: () => void;
  onKill: () => void;
  onClosePreview: () => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const fullCommand = selectedInventory && selectedPlaybook
    ? `ansible-playbook -i "${selectedInventory.path}" "${selectedPlaybook.path}"${limit ? ` --limit "${limit}"` : ''}`
    : '';

  const copyToClipboard = async () => {
    if (fullCommand) {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const showPreview = filePreview !== null && status !== "running";
  const showOutput = !showPreview && (status === "running" || status === "success" || status === "failed" || output.length > 0);

  const toolbar = (
    <div className="terminal-toolbar">
      <input
        type="text"
        className="limit-input"
        placeholder="--limit (optional)"
        value={limit}
        onChange={(e) => onLimitChange(e.target.value)}
      />
      {fullCommand && (
        <div className="command-wrapper">
          <div className="terminal-command-display">{fullCommand}</div>
          <button className="copy-btn" onClick={copyToClipboard} title="Copy command">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}
    </div>
  );

  const runOrStop = status === "running"
    ? <button className="execute-btn" onClick={onKill} style={{ background: 'var(--red)' }}><StopIcon />Stop</button>
    : <button className="execute-btn" disabled={!canExecute} onClick={onExecute}><PlayIcon />Run</button>;

  if (showPreview) {
    return (
      <div className="terminal">
        <div className="terminal-header">
          <div className="terminal-title">
            <PlaybookIcon />
            <span className="terminal-status-text terminal-preview-name">{filePreview!.name}</span>
            <span className="terminal-preview-path">{filePreview!.path}</span>
          </div>
          <div className="terminal-actions">
            {output.length > 0 && (
              <button className="preview-back-btn" onClick={onClosePreview}>← Output</button>
            )}
            {runOrStop}
          </div>
        </div>
        {toolbar}
        <div className="terminal-content" ref={terminalRef}>
          {filePreview!.content.split("\n").map((line, i) => (
            <div key={i} className="terminal-line terminal-line--preview">
              <span className="terminal-line-num">{i + 1}</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showOutput) {
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
            {runOrStop}
          </div>
        </div>
        {toolbar}
        <div className="terminal-content" ref={terminalRef}>
          {output.map((line, i) => (
            <AnsiLine key={i} line={line.line} stream={line.stream} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-status-dot terminal-status-dot--idle"></span>
          <span className="terminal-status-text">Ready</span>
        </div>
        <div className="terminal-actions">
          {runOrStop}
        </div>
      </div>
      {toolbar}
      <div className="terminal-content">
        <div className="terminal-empty">Select an inventory and playbook to get started</div>
      </div>
    </div>
  );
}

const ANSI_FG: Record<number, string> = {
  30: '#555', 31: '#ff7b72', 32: '#3fb950', 33: '#e3b341',
  34: '#79c0ff', 35: '#d2a8ff', 36: '#56d4dd', 37: '#e6edf3',
  90: '#6e7681', 91: '#ffa198', 92: '#56d364', 93: '#e3b341',
  94: '#79c0ff', 95: '#d2a8ff', 96: '#56d4dd', 97: '#f0f6fc',
};

interface AnsiSegment { text: string; color?: string; bold?: boolean; }

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let color: string | undefined;
  let bold = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), color, bold });
    }
    const codes = match[1] === '' ? [0] : match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) { color = undefined; bold = false; }
      else if (code === 1) { bold = true; }
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) { color = ANSI_FG[code]; }
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), color, bold });
  return segments.filter(s => s.text.length > 0);
}

const AnsiLine = memo(function AnsiLine({ line, stream }: { line: string; stream: string }) {
  const segments = parseAnsi(line);
  const hasAnsi = segments.some(s => s.color || s.bold);
  return (
    <div className={`terminal-line${hasAnsi ? '' : ` terminal-line--${stream}`}`}>
      {hasAnsi
        ? segments.map((seg, j) => (
            <span key={j} style={{ color: seg.color, fontWeight: seg.bold ? 'bold' : undefined }}>
              {seg.text}
            </span>
          ))
        : line}
    </div>
  );
});

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

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6,9 12,15 18,9" />
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

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function UpdateNotification({ version, onUpdate, onDismiss }: {
  version: string;
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="update-notification">
      <div className="update-buttons">
        <button className="update-btn" onClick={onUpdate}>Update</button>
        <button className="cancel-btn" onClick={onDismiss}>Cancel</button>
      </div>
      <p className="update-text">Update v{version} is available</p>
    </div>
  );
}

function StatusBar({ config, onSettingsClick }: {
  config: { ansible_dir: string; inventory_dir: string; playbook_dir: string } | null;
  onSettingsClick: () => void;
}) {
  const shorten = (path: string) => {
    return path.replace(/^\/home\/[^/]+/, '~');
  };

  return (
    <div className="status-bar">
      <div className="status-info">
        {config && (
          <>
            <span className="status-label">Inv:</span>
            <span className="status-path">{shorten(config.inventory_dir)}</span>
            <span className="status-sep">|</span>
            <span className="status-label">PB:</span>
            <span className="status-path">{shorten(config.playbook_dir)}</span>
            <span className="status-sep">|</span>
            <span className="status-label">Ansible:</span>
            <span className="status-path">{shorten(config.ansible_dir)}</span>
          </>
        )}
      </div>
      <button className="status-settings-btn" onClick={onSettingsClick}>
        <GearIcon />
      </button>
    </div>
  );
}