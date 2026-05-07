import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Inventory, Playbook, ExecutionStatus, ExecutionOutput } from "../types";

interface AppState {
  inventories: Inventory[];
  playbooks: Playbook[];
  selectedInventory: Inventory | null;
  selectedPlaybook: Playbook | null;
  status: ExecutionStatus;
  output: ExecutionOutput[];

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
      const result = await invoke<{ success: boolean; stdout: string; stderr: string }>("run_playbook", {
        inventory: selectedInventory.path,
        playbook: selectedPlaybook.path,
      });

      const output: ExecutionOutput[] = [];
      
      if (result.stdout) {
        result.stdout.split("\n").forEach((line) => {
          if (line) output.push({ line, type: "stdout" });
        });
      }
      if (result.stderr) {
        result.stderr.split("\n").forEach((line) => {
          if (line) output.push({ line, type: "stderr" });
        });
      }

      set({
        output: output.length > 0 ? output : [{ line: result.success ? "Done" : "Failed", type: result.success ? "info" : "stderr" }],
        status: result.success ? "success" : "failed",
      });
    } catch (err) {
      set({
        output: [{ line: String(err), type: "stderr" }],
        status: "failed",
      });
    }
  },

  clearOutput: () => set({ output: [], status: "idle" }),
}));