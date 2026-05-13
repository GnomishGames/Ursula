import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Inventory, Playbook, ExecutionStatus, OutputLine } from "../types";

interface AppConfig {
  ansible_dir: string;
  inventory_dir: string;
  playbook_dir: string;
}

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  limit: string;
  status: ExecutionStatus;
  output: OutputLine[];
  config: AppConfig | null;
  settingsOpen: boolean;

  loadData: () => Promise<void>;
  selectInventory: (inv: Inventory | null) => void;
  selectPlaybook: (pb: Playbook | null) => void;
  setLimit: (limit: string) => void;
  execute: () => Promise<void>;
  kill: () => Promise<void>;
  clearOutput: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (config: AppConfig) => Promise<void>;
  toggleSettings: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  inventories: [],
  playbooks: [],
  selectedInventory: null,
  selectedPlaybook: null,
  limit: "",
  status: "idle",
  output: [],
  config: null,
  settingsOpen: false,

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

  selectInventory: (inv) => set({ selectedInventory: inv, limit: "" }),

  selectPlaybook: (pb) => set({ selectedPlaybook: pb }),

  setLimit: (limit) => set({ limit }),

  execute: async () => {
    const { selectedInventory, selectedPlaybook, limit, clearOutput } = get();
    if (!selectedInventory || !selectedPlaybook) return;

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

  loadSettings: async () => {
    try {
      const config = await invoke<AppConfig>("get_settings");
      set({ config });
    } catch {
      set({ config: null });
    }
  },

  saveSettings: async (config) => {
    try {
      await invoke("save_settings", { config });
      set({ config, settingsOpen: false });
      await get().loadData();
    } catch {
    }
  },

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
}));