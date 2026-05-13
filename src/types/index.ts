export interface Inventory {
  id: string;
  name: string;
  path: string;
  is_folder: boolean;
  children: Inventory[];
}

export interface Playbook {
  id: string;
  name: string;
  path: string;
  is_folder: boolean;
  children: Playbook[];
}

export type ExecutionStatus = "idle" | "running" | "success" | "failed";

export interface LinePart {
  text: string;
  stream: string;
}

export interface OutputLine {
  line: string;
  stream: string;
  parts?: LinePart[];
}