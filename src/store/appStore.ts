import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Inventory, Playbook, ExecutionStatus, OutputLine } from "../types";

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  groups: string[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  limit: string;
  status: ExecutionStatus;
  output: OutputLine[];

  loadData: () => Promise<void>;
  selectInventory: (inv: Inventory | null) => void;
  selectPlaybook: (pb: Playbook | null) => void;
  setLimit: (limit: string) => void;
  execute: () => Promise<void>;
  clearOutput: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  inventories: [],
  playbooks: [],
  groups: [],
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
    set({ selectedInventory: inv, groups: [], limit: "" });
    if (inv) {
      try {
        const groups = await invoke<string[]>("list_groups", { inventory: inv.path });
        set({ groups });
      } catch {
        set({ groups: [] });
      }
    }
  },

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

  clearOutput: () => set({ output: [], status: "idle" }),
}));