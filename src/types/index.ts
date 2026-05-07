export interface Inventory {
  id: string;
  name: string;
  path: string;
}

export interface Playbook {
  id: string;
  name: string;
  path: string;
}

export type ExecutionStatus = "idle" | "running" | "success" | "failed";

export interface ExecutionOutput {
  line: string;
  type: "stdout" | "stderr" | "info";
}