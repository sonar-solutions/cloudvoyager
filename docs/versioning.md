# Versioning
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

How CloudVoyager versions are managed, bumped, and released.

---

## Source of Truth
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The **single source of truth** for the application version is:

```
package.json  →  "version" field  (root of repo)
```

Every workflow reads the version from this file. The version-bump workflow writes to this file. All downstream release artifacts (CLI binaries, desktop apps, GitHub Release tags) derive their version from it.

The CLI (`src/index.js`) reads the version dynamically rather than hardcoding it:
- **Production builds**: esbuild injects the version at build time via `define: { '__APP_VERSION__': ... }` in `scripts/build.js`
- **Dev mode** (`node src/index.js`): falls back to reading `package.json` directly via `createRequire`

---

## Where the Version Appears
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Location | File | Updated By |
|----------|------|------------|
| **Root package.json** | `package.json` | `version-bump.yml` (automatic) |
| **Root package-lock.json** | `package-lock.json` | `version-bump.yml` (automatic, via `npm version`) |
| **CLI `--version` flag** | `src/index.js` (dynamic, from `package.json`) | Automatic — reads `package.json` at build/runtime |
| **Desktop app version** | `desktop/package.json` | `version-bump.yml` (automatic, via `npm version`) |
| **Desktop lock file** | `desktop/package-lock.json` | `version-bump.yml` (automatic, via `npm version`) |

The package.json files are updated automatically by the version-bump workflow. The CLI version is derived at build time (no manual update needed).

---

## How the Version Gets Bumped
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The version bump is triggered by **merging a pull request to `main` that has a GitHub milestone attached**.

### Trigger Conditions
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Both conditions must be true:
1. The PR is **merged** (not just closed)
2. The PR has a **milestone** assigned (e.g., `1.2`, `1.3`)

If either condition is missing, no version bump occurs.

### Bump Logic
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The workflow (`.github/workflows/version-bump.yml`) compares the milestone title to the current version:

| Scenario | Current Version | Milestone | Result |
|----------|----------------|-----------|--------|
| Same major.minor | `1.2.1` | `1.2` | `1.2.2` (patch bump) |
| New major.minor | `1.2.5` | `1.3` | `1.3.0` (reset patch to 0) |

### What the Workflow Does
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

1. Reads the milestone title from the merged PR
2. Reads the current version from `package.json`
3. Computes the new version using the logic above
4. Runs `npm version <NEW_VERSION> --no-git-tag-version` (root and desktop)
5. Commits `package.json`, `package-lock.json`, `desktop/package.json`, and `desktop/package-lock.json` with message: `chore: bump version to <NEW_VERSION>`
6. Pushes the commit to `main`

---

## Release Pipeline
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Every push to `main` triggers the full release pipeline (`.github/workflows/release.yml`):

```
push to main
  └─ install.yml        Cache node_modules
       └─ build.yml     Build 6 CLI binaries (linux/macos/win × x64/arm64)
            ├─ tag job   Generate tag: v{VERSION}-{YYYYMMDDHHMMSS}
            └─ build-desktop.yml   Build 8 desktop apps (Electron)
                 └─ gh-release.yml   Create GitHub Release with all assets
```

### Tag Format
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```
v1.2.0-20260328120445
│ │      │
│ │      └── Timestamp (ensures uniqueness)
│ └── Version from package.json
└── Prefix
```

### Release Body
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The release includes:
- Auto-generated release notes (from commit history)
- A link to the GitHub milestone matching the major.minor version
- All CLI binaries and desktop app installers as assets

---

## Desktop App Versioning
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The desktop app version is read from `desktop/package.json` by `electron-builder`. This determines the version shown in:
- Installer filenames (e.g., `CloudVoyager.Desktop-1.2.0-macos-arm64.dmg`)
- The app's About dialog
- OS-level app metadata

The `electron-builder.yml` config uses `${version}` which resolves to `desktop/package.json`'s version field.

---

## Milestones
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

GitHub milestones serve two purposes:

1. **Version control** — The milestone title (e.g., `1.2`) determines the major.minor version for the bump
2. **Release notes** — The release body links back to the milestone page for issue tracking

Milestone titles must be in `MAJOR.MINOR` format (e.g., `1.2`, `1.3`, `2.0`).

---

## Workflow Files
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Workflow | File | Purpose |
|----------|------|---------|
| Version Bump | `.github/workflows/version-bump.yml` | Bumps version on PR merge with milestone |
| Build & Release | `.github/workflows/release.yml` | Orchestrates the full release pipeline |
| Install | `.github/workflows/install.yml` | Caches `node_modules` |
| Build CLI | `.github/workflows/build.yml` | Builds CLI binaries, generates release tag |
| Build Desktop | `.github/workflows/build-desktop.yml` | Builds Electron desktop apps |
| GitHub Release | `.github/workflows/gh-release.yml` | Creates the GitHub Release with all assets |
