import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Inventory, Playbook, ExecutionStatus, OutputLine } from "../types";

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  groups: string[];
  layer2: string[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  limit: string;
  status: ExecutionStatus;
  output: OutputLine[];

  loadData: () => Promise<void>;
  selectInventory: (inv: Inventory | null) => void;
  selectPlaybook: (pb: Playbook | null) => void;
  setLimit: (limit: string) => void;
  loadLayer2: (group: string) => Promise<void>;
  execute: () => Promise<void>;
  kill: () => Promise<void>;
  clearOutput: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  inventories: [],
  playbooks: [],
  groups: [],
  layer2: [],
  selectedInventory: null,
  selectedPlaybook: null,
  limit: "",
  status: "idle",
  output: [],

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

  selectInventory: async (inv) => {
    set({ selectedInventory: inv, groups: [], layer2: [], limit: "" });
    if (inv) {
      try {
        const groups = await invoke<string[]>("list_all_children", { inventory: inv.path });
        set({ groups, layer2: [] });
      } catch {
        set({ groups: [], layer2: [] });
      }
    }
  },

  selectPlaybook: (pb) => set({ selectedPlaybook: pb }),

  setLimit: (limit) => set({ limit }),

  loadLayer2: async (group) => {
    const { selectedInventory } = get();
    if (!selectedInventory || !group) return;
    try {
      const layer2 = await invoke<string[]>("list_children", { 
        inventory: selectedInventory.path, 
        group 
      });
      set({ layer2 });
    } catch {
      set({ layer2: [] });
    }
  },

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
}));