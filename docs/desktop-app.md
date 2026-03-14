# 🖥️ Desktop App

<!-- Last updated: Mar 14, 2026 at 12:00:00 PM -->

CloudVoyager Desktop wraps the CLI binary in a guided wizard UI built with Electron. No terminal needed — fill in forms, click Start, and watch live logs stream in real-time. All configuration persists between app restarts with encrypted token storage.

Available for: **Linux x64**, **Linux ARM64**, **macOS ARM64**, **Windows x64**, **Windows ARM64**.

## 📦 Installation

Download the latest release from the [GitHub Releases](https://github.com/your-org/cloudvoyager/releases) page. Choose the installer for your platform:

| Platform | Format | File |
|----------|--------|------|
| Linux x64 | AppImage | `CloudVoyager-x.x.x-linux-x86_64.AppImage` |
| Linux ARM64 | AppImage | `CloudVoyager-x.x.x-linux-arm64.AppImage` |
| macOS ARM64 | DMG | `CloudVoyager-x.x.x-mac-arm64.dmg` |
| Windows x64 | NSIS Installer | `CloudVoyager-x.x.x-win-x64-setup.exe` |
| Windows ARM64 | NSIS Installer | `CloudVoyager-x.x.x-win-arm64-setup.exe` |

> The app bundles the CLI binary — no separate CLI install is needed.

## 🚀 Getting Started

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->
### Welcome Screen

On launch, the Welcome screen presents the available workflows:

- **Transfer One Project** — Migrate a single project from SonarQube to SonarCloud
- **Move All Projects & Settings** — Full organization migration (projects, quality gates, profiles, permissions, etc.)
- **Verify Migration Results** — Compare data between source and destination after migration
- **Sync Settings & Policies** — Update coding rules, policies, and permissions without re-migrating code data
- **Check Progress** — View migration progress and state
- **Clear Migration History** — Reset state and clear sync history

### Wizard Flow

Each workflow guides you through a series of screens:

1. **Connection setup** — Enter SonarQube and SonarCloud URLs and tokens
2. **Options** — Configure transfer mode, branch selection, and other settings
3. **Review** — Confirm all settings before starting
4. **Start** — Kick off the migration and watch live logs

The live log viewer shows migration progress in real-time with a timer, cancel button, and status badge. When complete, the results screen shows generated report files that you can browse and open.

## 🧙 Wizard Screens

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->
### Transfer Config (4 steps)

| Step | Description |
|------|-------------|
| 1. SonarQube Connection | Enter URL and token for the source SonarQube instance |
| 2. SonarCloud Connection | Enter URL, token, organization, and project key for the target |
| 3. Transfer Settings | Choose transfer mode (full/incremental), batch size, branch options |
| 4. Review & Start | Review all settings and begin the transfer |

### Migrate Config (4 steps)

| Step | Description |
|------|-------------|
| 1. SonarQube Connection | Enter URL and admin token for the source SonarQube instance |
| 2. SonarCloud Organizations | Add or remove target SonarCloud organizations with their tokens |
| 3. Migration Settings | Configure output directory, dry run, included/excluded projects |
| 4. Review & Start | Review all settings and begin the full migration |

### Other Screens

- **Verify** — Compares data between source SonarQube and destination SonarCloud to confirm migration completeness
- **Sync Metadata** — Updates coding rules, policies, and permissions without re-migrating code data
- **Connection Test** — Runs the `test` command to verify connectivity to both SonarQube and SonarCloud
- **Execution** — Live log viewer with elapsed timer, cancel button, and status badge (running/success/failed)
- **Results** — Browse and open generated report files from the migration output directory
- **Run History** (sidebar) — Lists past successful migration and transfer runs in the sidebar. Click any entry to view its reports. History persists across app restarts (max 50 entries).
- **Status** — View migration progress, sync history, and reset state

## 🔐 Configuration Persistence

- All settings are saved automatically as you navigate between wizard steps
- Tokens are encrypted at rest using `electron-store`
- Window size and position are remembered across restarts
- Migration run history (last 50 entries) is stored for quick access to past reports
- Config is stored in the platform-specific user data directory:

| Platform | Location |
|----------|----------|
| Linux | `~/.config/cloudvoyager-desktop/` |
| macOS | `~/Library/Application Support/cloudvoyager-desktop/` |
| Windows | `%APPDATA%\cloudvoyager-desktop\` |

## 🔨 Building from Source

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->
### Prerequisites

- Node.js v20+
- The CLI binary placed in `desktop/resources/cli/` (use `node scripts/prepare-cli.js` to copy from `dist/bin/`)

### Development

```bash
cd desktop
npm install
npm start          # Run in dev mode (uses src/index.js as CLI fallback)
```

### Distribution Builds

```bash
npm run build:linux-x64
npm run build:linux-arm64
npm run build:mac-arm64
npm run build:win-x64
npm run build:win-arm64
```

Output artifacts are placed in the `desktop/dist/` directory.

## 🏗️ Architecture

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->

The desktop app lives in the `desktop/` directory at the repository root:

```
desktop/
├── package.json
├── electron-builder.yml
├── scripts/prepare-cli.js
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process
│   │   ├── cli-runner.js    # CLI binary spawner
│   │   ├── ipc-handlers.js  # IPC channel registrations
│   │   └── config-store.js  # electron-store wrapper
│   ├── preload/preload.js   # contextBridge API
│   └── renderer/
│       ├── index.html
│       ├── styles/
│       └── js/
│           ├── app.js       # Screen router
│           ├── screens/     # Wizard screens
│           └── components/  # Reusable UI (log viewer, form builder, wizard nav, sidebar history)
└── assets/                  # App icons
```

### Key Design Decisions

- **Electron 33+** with vanilla HTML/CSS/JS — no framework dependency
- **`contextBridge` / IPC** for secure renderer communication (`nodeIntegration` is disabled)
- **`electron-store`** for encrypted config persistence
- **`electron-builder`** for cross-platform packaging
- **Child process spawning** — the CLI binary is spawned as a child process with stdout/stderr piped for live log streaming
- **Dark theme UI** with wizard-based navigation flow
- **Default window size** of 1400x850 for comfortable log viewing

## 📊 CLI vs Desktop Feature Comparison

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->

Both the CLI and Desktop app provide the same migration capabilities. The Desktop app adds a graphical wrapper with guided wizards and encrypted storage.

| Feature | CLI | Desktop |
|---------|-----|---------|
| Transfer single project | Yes | Yes |
| Full org migration | Yes | Yes |
| Verify migration | Yes | Yes |
| Sync metadata | Yes | Yes |
| Live log output | Terminal | Built-in log viewer |
| Config format | JSON file | Guided wizard |
| Encrypted token storage | No | Yes (electron-store) |
| Run history sidebar | No | Yes (last 50 runs) |
| Platform support | 5 platforms | 5 platforms |
