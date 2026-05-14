import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Inventory, Playbook, ExecutionStatus, OutputLine } from "../types";

interface AppConfig {
  ansible_dir: string;
  inventory_dir: string;
  playbook_dir: string;
}

export interface Theme {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  // ── Dark themes ──────────────────────────────────────
  {
    id: "midnight",
    name: "Midnight",
    vars: {
      "--color-scheme": "dark",
      "--bg-base": "#1a1a1a",
      "--bg-surface": "#1e1e1e",
      "--bg-elevated": "#252525",
      "--bg-hover": "#2a2a2a",
      "--border": "#333",
      "--border-light": "#444",
      "--text-primary": "#e0e0e0",
      "--text-secondary": "#888",
      "--text-muted": "#555",
      "--accent": "#58a6ff",
      "--accent-dim": "#1a3a5c",
      "--green": "#3fb950",
      "--red": "#ff7b72",
      "--yellow": "#e3b341",
      "--terminal-bg": "#1a1a1a",
      "--terminal-text": "#e0e0e0",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    vars: {
      "--color-scheme": "dark",
      "--bg-base": "#282a36",
      "--bg-surface": "#21222c",
      "--bg-elevated": "#343746",
      "--bg-hover": "#3d3f4f",
      "--border": "#44475a",
      "--border-light": "#6272a4",
      "--text-primary": "#f8f8f2",
      "--text-secondary": "#bd93f9",
      "--text-muted": "#6272a4",
      "--accent": "#bd93f9",
      "--accent-dim": "#362b5a",
      "--green": "#50fa7b",
      "--red": "#ff5555",
      "--yellow": "#f1fa8c",
      "--terminal-bg": "#282a36",
      "--terminal-text": "#f8f8f2",
    },
  },
  {
    id: "nord",
    name: "Nord",
    vars: {
      "--color-scheme": "dark",
      "--bg-base": "#2e3440",
      "--bg-surface": "#3b4252",
      "--bg-elevated": "#434c5e",
      "--bg-hover": "#4c566a",
      "--border": "#434c5e",
      "--border-light": "#4c566a",
      "--text-primary": "#eceff4",
      "--text-secondary": "#d8dee9",
      "--text-muted": "#81a1c1",
      "--accent": "#88c0d0",
      "--accent-dim": "#3d4e62",
      "--green": "#a3be8c",
      "--red": "#bf616a",
      "--yellow": "#ebcb8b",
      "--terminal-bg": "#2e3440",
      "--terminal-text": "#eceff4",
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    vars: {
      "--color-scheme": "dark",
      "--bg-base": "#282828",
      "--bg-surface": "#3c3836",
      "--bg-elevated": "#504945",
      "--bg-hover": "#665c54",
      "--border": "#504945",
      "--border-light": "#665c54",
      "--text-primary": "#ebdbb2",
      "--text-secondary": "#a89984",
      "--text-muted": "#7c6f64",
      "--accent": "#fe8019",
      "--accent-dim": "#3d3120",
      "--green": "#b8bb26",
      "--red": "#fb4934",
      "--yellow": "#fabd2f",
      "--terminal-bg": "#282828",
      "--terminal-text": "#ebdbb2",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    vars: {
      "--color-scheme": "dark",
      "--bg-base": "#1e1e2e",
      "--bg-surface": "#181825",
      "--bg-elevated": "#313244",
      "--bg-hover": "#45475a",
      "--border": "#313244",
      "--border-light": "#45475a",
      "--text-primary": "#cdd6f4",
      "--text-secondary": "#bac2de",
      "--text-muted": "#7f849c",
      "--accent": "#cba6f7",
      "--accent-dim": "#2a273f",
      "--green": "#a6e3a1",
      "--red": "#f38ba8",
      "--yellow": "#f9e2af",
      "--terminal-bg": "#1e1e2e",
      "--terminal-text": "#cdd6f4",
    },
  },
  // ── Light themes ─────────────────────────────────────
  {
    id: "github-light",
    name: "GitHub Light",
    vars: {
      "--color-scheme": "light",
      "--bg-base": "#ffffff",
      "--bg-surface": "#f6f8fa",
      "--bg-elevated": "#eaeef2",
      "--bg-hover": "#dde3eb",
      "--border": "#d0d7de",
      "--border-light": "#bbc1c8",
      "--text-primary": "#1f2328",
      "--text-secondary": "#57606a",
      "--text-muted": "#8c959f",
      "--accent": "#0969da",
      "--accent-dim": "#dbeafe",
      "--green": "#1a7f37",
      "--red": "#cf222e",
      "--yellow": "#9a6700",
      "--terminal-bg": "#1a1a1a",
      "--terminal-text": "#e0e0e0",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    vars: {
      "--color-scheme": "light",
      "--bg-base": "#fdf6e3",
      "--bg-surface": "#eee8d5",
      "--bg-elevated": "#e8e2cf",
      "--bg-hover": "#ddd6c0",
      "--border": "#ccc6ae",
      "--border-light": "#b9b3a0",
      "--text-primary": "#657b83",
      "--text-secondary": "#839496",
      "--text-muted": "#93a1a1",
      "--accent": "#268bd2",
      "--accent-dim": "#d4e8f7",
      "--green": "#859900",
      "--red": "#dc322f",
      "--yellow": "#b58900",
      "--terminal-bg": "#002b36",
      "--terminal-text": "#839496",
    },
  },
  {
    id: "one-light",
    name: "One Light",
    vars: {
      "--color-scheme": "light",
      "--bg-base": "#fafafa",
      "--bg-surface": "#f0f0f0",
      "--bg-elevated": "#e8e8e8",
      "--bg-hover": "#dedede",
      "--border": "#d3d3d3",
      "--border-light": "#c4c4c4",
      "--text-primary": "#383a42",
      "--text-secondary": "#696c77",
      "--text-muted": "#a0a1a7",
      "--accent": "#4078f2",
      "--accent-dim": "#d8e3fd",
      "--green": "#50a14f",
      "--red": "#e45649",
      "--yellow": "#c18401",
      "--terminal-bg": "#1a1a1a",
      "--terminal-text": "#e0e0e0",
    },
  },
];

export function applyTheme(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

interface FilePreview {
  name: string;
  path: string;
  content: string;
}

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  limit: string;
  status: ExecutionStatus;
  output: OutputLine[];
  filePreview: FilePreview | null;
  config: AppConfig | null;
  settingsOpen: boolean;
  theme: string;
  updateAvailable: boolean;
  latestVersion: string;

  loadData: () => Promise<void>;
  selectInventory: (inv: Inventory | null) => void;
  selectPlaybook: (pb: Playbook | null) => void;
  setLimit: (limit: string) => void;
  execute: () => Promise<void>;
  kill: () => Promise<void>;
  clearOutput: () => void;
  loadFilePreview: (path: string, name: string) => Promise<void>;
  closeFilePreview: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (config: AppConfig) => Promise<void>;
  toggleSettings: () => void;
  setTheme: (id: string) => void;
  checkForUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  inventories: [],
  playbooks: [],
  selectedInventory: null,
  selectedPlaybook: null,
  limit: "",
  status: "idle",
  output: [],
  filePreview: null,
  config: null,
  settingsOpen: false,
  theme: localStorage.getItem("ursula-theme") || "midnight",
  updateAvailable: false,
  latestVersion: "",

  loadData: async () => {
    try {
      const [inventories, playbooks] = await Promise.all([
        invoke<Inventory[]>("list_inventories"),
        invoke<Playbook[]>("list_playbooks"),
      ]);
      set({ inventories, playbooks });
    } catch {
      set({ inventories: [], playbooks: [] });
    }
  },

  selectInventory: (inv) => {
    set({ selectedInventory: inv, limit: "" });
    if (inv && get().status !== "running") get().loadFilePreview(inv.path, inv.name);
  },

  selectPlaybook: (pb) => {
    set({ selectedPlaybook: pb });
    if (pb && get().status !== "running") get().loadFilePreview(pb.path, pb.name);
  },

  setLimit: (limit) => set({ limit }),

  execute: async () => {
    const { selectedInventory, selectedPlaybook, limit, clearOutput } = get();
    if (!selectedInventory || !selectedPlaybook) return;

    set({ filePreview: null });
    clearOutput();
    set({ status: "running" });

    try {
      const unlisten = await listen<OutputLine>("ansible-output", (event) => {
        set((state) => ({
          output: [...state.output, event.payload],
        }));
      });

      const unlistenComplete = await listen<boolean>("ansible-complete", (event) => {
        set({ status: event ? "success" : "failed" });
      });

      await invoke("run_playbook", {
        inventory: selectedInventory.path,
        playbook: selectedPlaybook.path,
        limit: limit || null,
      });

      unlisten();
      unlistenComplete();
    } catch (err) {
      set({
        output: [{ line: String(err), stream: "stderr" }],
        status: "failed",
      });
    }
  },

  kill: async () => {
    try {
      await invoke("kill_playbook");
      set({ status: "failed", output: [...get().output, { line: "\nProcess killed", stream: "stderr" }] });
    } catch {}
  },

  clearOutput: () => set({ output: [], status: "idle" }),

  loadFilePreview: async (path, name) => {
    try {
      const content = await invoke<string>("read_file", { path });
      set({ filePreview: { name, path, content } });
    } catch {}
  },

  closeFilePreview: () => set({ filePreview: null }),

  loadSettings: async () => {
    try {
      const config = await invoke<AppConfig>("get_settings");
      const savedId = localStorage.getItem("ursula-theme") || "midnight";
      const saved = THEMES.find((t) => t.id === savedId) ?? THEMES[0];
      applyTheme(saved.vars);
      set({ config, theme: saved.id });
    } catch {
      set({ config: null });
    }
  },

  saveSettings: async (config) => {
    try {
      await invoke("save_settings", { config });
      set({ config, settingsOpen: false });
      await get().loadData();
    } catch {}
  },

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setTheme: (id) => {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;
    applyTheme(theme.vars);
    localStorage.setItem("ursula-theme", id);
    set({ theme: id });
  },

  checkForUpdate: async () => {
    try {
      const info = await invoke<{ update_available: boolean; latest_version: string; current_version: string }>("check_for_updates");
      if (info.update_available) {
        set({ updateAvailable: true, latestVersion: info.latest_version });
      }
    } catch {}
  },

  dismissUpdate: () => set({ updateAvailable: false }),
}));
