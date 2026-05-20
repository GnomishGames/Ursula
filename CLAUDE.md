# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What it is

Ursula is a Tauri v2 desktop app that provides a GUI for running Ansible playbooks. Users pick an inventory file and a playbook from resizable sidebars, then click Run to stream `ansible-playbook` output into a terminal panel. Settings (paths, Git integration, theme) are persisted across restarts.

## Commands

```bash
# Full dev mode — launches the app with hot reload (requires Rust + Node)
npm run tauri dev

# Frontend only (Vite dev server on port 5174, no native window)
npm run dev

# Type-check + bundle frontend
npm run build

# Full release build — produces installers in src-tauri/target/release/bundle/
npm run tauri build

# Rust only (run from src-tauri/)
cargo build
cargo check
```

There are no tests and no lint configs in this project.

## Architecture

### Frontend (`src/`)

| File | Role |
|---|---|
| `src/App.tsx` | Entire UI — all components are defined here (no separate component files) |
| `src/store/appStore.ts` | Single Zustand store; owns all app state and all `invoke()` calls |
| `src/types/index.ts` | Shared TypeScript types (`Inventory`, `Playbook`, `OutputLine`, `ExecutionStatus`) |

All frontend→backend communication goes through Tauri's `invoke()` in the store. Real-time playbook output arrives via Tauri events (`ansible-output`, `ansible-complete`) that the store listens to during execution.

Theme variables are CSS custom properties applied to `document.documentElement`; the active theme ID is saved to `localStorage`. All theme definitions live in `THEMES` in `appStore.ts`.

### Backend (`src-tauri/src/`)

All Tauri commands live in `src-tauri/src/commands/mod.rs` and are registered in `lib.rs`. The commands are:

| Command | Purpose |
|---|---|
| `list_inventories` / `list_playbooks` | Recursively scan configured dirs for `.yml`/`.yaml` files |
| `get_settings` / `save_settings` | Read/write config via `tauri-plugin-store` (`config.json`) |
| `run_playbook` | Spawn `ansible-playbook`, stream stdout/stderr line-by-line as events |
| `kill_playbook` | Send SIGTERM to the running process |
| `read_file` | Read a file for the in-app preview panel |
| `check_for_updates` | Hit GitHub releases API to compare versions |

The running child process handle is stored in a `lazy_static` `tokio::sync::Mutex<Option<Child>>` (`RUNNING_CHILD`) so `kill_playbook` can reference it safely across async tasks.

Config defaults: `~/Documents/ansible/` for the Ansible dir, with `inventory/` and `playbook/` subdirectories.

### IPC flow for playbook execution

1. Frontend calls `invoke("run_playbook", { inventory, playbook, limit })`
2. Rust optionally runs `git pull`, then spawns `ansible-playbook` with `ANSIBLE_FORCE_COLOR=1`
3. Two tokio tasks read stdout/stderr line by line, categorizing each line (`categorize_ansible_line`) and emitting `ansible-output` events
4. Frontend store appends each `OutputLine` to `output[]` in state → Terminal re-renders
5. On process exit, Rust emits `ansible-complete` (bool) → store sets `status` to `"success"` or `"failed"`

### Releases

Tag a commit `v*` to trigger the GitHub Actions release workflow (`.github/workflows/release.yml`). It builds Windows (NSIS/MSI), macOS (universal DMG), and Linux (`.deb` + AppImage). Version must be kept in sync across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
