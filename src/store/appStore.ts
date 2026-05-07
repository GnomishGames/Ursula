import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Inventory, Playbook, ExecutionStatus, OutputLine } from "../types";

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  status: ExecutionStatus;
  output: OutputLine[];

  loadData: () => Promise<void>;
  selectInventory: (inv: Inventory | null) => void;
  selectPlaybook: (pb: Playbook | null) => void;
  execute: () => Promise<void>;
  clearOutput: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  inventories: [],
  playbooks: [],
  selectedInventory: null,
  selectedPlaybook: null,
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

  selectInventory: (inv) => set({ selectedInventory: inv }),

  selectPlaybook: (pb) => set({ selectedPlaybook: pb }),

  execute: async () => {
    const { selectedInventory, selectedPlaybook } = get();
    if (!selectedInventory || !selectedPlaybook) return;

    set({ status: "running", output: [] });

    try {
      const unlisten = await listen<OutputLine>("ansible-output", (event) => {
        set((state) => ({
          output: [...state.output, event.payload],
        }));
      });

      const unlistenComplete = await listen<boolean>("ansible-complete", (event) => {
        set({ status: event.payload ? "success" : "failed" });
      });

      await invoke("run_playbook", {
        inventory: selectedInventory.path,
        playbook: selectedPlaybook.path,
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