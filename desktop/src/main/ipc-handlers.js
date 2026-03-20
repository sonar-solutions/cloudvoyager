const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadAll, saveAll, loadConfig, saveConfig } = require('./config-store');
const { runCommand, cancelCommand } = require('./cli-runner');

function getDefaultReportsDir() {
  return path.join(app.getPath('documents'), 'CloudVoyager', 'reports');
}

/**
 * Parse a transfer checkpoint journal and return progress info, or null if
 * the journal doesn't exist or is already completed.
 */
function parseTransferJournal(runDir) {
  const journalPath = path.join(runDir, '.cloudvoyager-state.json.journal');
  if (!fs.existsSync(journalPath)) return null;
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  } catch {
    return null;
  }
  if (journal.status === 'completed') return null;

  const phases = journal.phases || {};
  const phaseNames = Object.keys(phases);
  const branches = journal.branches || {};
  const branchNames = Object.keys(branches);

  return {
    startedAt: journal.sessionFingerprint?.startedAt,
    status: journal.status,
    progress: {
      completedPhases: phaseNames.filter(p => phases[p].status === 'completed').length,
      totalPhases: phaseNames.length,
      completedBranches: branchNames.filter(b => branches[b].status === 'completed').length,
      totalBranches: branchNames.length,
      projectKey: journal.sessionFingerprint?.projectKey
    }
  };
}

/**
 * Parse a migration journal and return progress info, or null if the
 * journal doesn't exist or is already completed.
 */
function parseMigrationJournal(runDir) {
  const journalPath = path.join(runDir, 'state', 'migration.journal');
  if (!fs.existsSync(journalPath)) return null;
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  } catch {
    return null;
  }
  if (journal.status === 'completed') return null;

  const orgs = journal.organizations || {};
  const orgKeys = Object.keys(orgs);
  let totalProjects = 0, completedProjects = 0, failedProjects = 0;
  for (const orgKey of orgKeys) {
    const projects = orgs[orgKey].projects || {};
    for (const status of Object.values(projects)) {
      totalProjects++;
      if (status.status === 'completed') completedProjects++;
      if (status.status === 'failed') failedProjects++;
    }
  }

  return {
    startedAt: journal.startedAt,
    status: journal.status,
    progress: {
      completedOrgs: orgKeys.filter(k => orgs[k].status === 'completed').length,
      totalOrgs: orgKeys.length,
      completedProjects,
      totalProjects,
      failedProjects
    }
  };
}

function registerIpcHandlers(getMainWindow) {
  // Config handlers
  ipcMain.handle('config:load', () => {
    return loadAll();
  });

  ipcMain.handle('config:save', (_event, data) => {
    saveAll(data);
    return true;
  });

  ipcMain.handle('config:load-key', (_event, key) => {
    return loadConfig(key);
  });

  ipcMain.handle('config:save-key', (_event, key, value) => {
    saveConfig(key, value);
    return true;
  });

  // Checkpoint/journal detection for resume prompts
  ipcMain.handle('checkpoint:detect', (_event, configType) => {
    try {
      const allConfig = loadAll();
      const baseReportsDir = allConfig.reportsDir || getDefaultReportsDir();
      if (!fs.existsSync(baseReportsDir)) return { found: false };

      const entries = fs.readdirSync(baseReportsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('run-'))
        .sort((a, b) => b.name.localeCompare(a.name));

      const parser = configType === 'transfer' ? parseTransferJournal : parseMigrationJournal;
      for (const entry of entries) {
        const runDir = path.join(baseReportsDir, entry.name);
        try {
          const result = parser(runDir);
          if (!result) continue;
          return {
            found: true,
            runDir,
            startedAt: result.startedAt || (() => {
              const raw = entry.name.replace('run-', '');
              const d = new Date(raw);
              return Number.isNaN(d.getTime()) ? entry.name : raw;
            })(),
            status: result.status,
            progress: result.progress
          };
        } catch {
          continue;
        }
      }
      return { found: false };
    } catch {
      return { found: false };
    }
  });

  // CLI handlers
  ipcMain.handle('cli:run', (_event, command, args, configType, resumeRunDir) => {
    const allConfig = loadAll();
    // Use explicit configType when provided (e.g. from connection-test screen),
    // otherwise infer from the command name for backward compatibility.
    const isTransfer = configType
      ? configType === 'transfer'
      : ['transfer', 'test', 'validate', 'status', 'reset'].includes(command);
    const originalConfig = isTransfer ? allConfig.transferConfig : allConfig.migrateConfig;
    // Deep clone to avoid mutating the original config object
    const config = structuredClone(originalConfig);
    const envVars = allConfig.envVars || {};

    let runDir;
    if (resumeRunDir && fs.existsSync(resumeRunDir)) {
      // Resume: reuse existing run directory
      runDir = resumeRunDir;
    } else {
      // Fresh run: create a new timestamped subdirectory
      const baseReportsDir = allConfig.reportsDir || getDefaultReportsDir();
      const ts = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19); // e.g. 2026-03-14T15-30-45
      runDir = path.join(baseReportsDir, `run-${ts}`);
      fs.mkdirSync(runDir, { recursive: true });
    }

    // For migrate/verify, set outputDir to the run directory
    if (!isTransfer && config.migrate) {
      config.migrate.outputDir = runDir;
    }

    // Strip underscore-prefixed transient properties (e.g. _verbose, _waitAnalysis,
    // _onlyComponents) that the desktop UI stores on the config object but that are
    // not part of the CLI JSON schema (they are passed as CLI args instead).
    const cleanConfig = Object.fromEntries(
      Object.entries(config).filter(([k]) => !k.startsWith('_'))
    );

    // For migrate configs, the transfer schema doesn't allow stateFile or checkpoint
    if (!isTransfer && cleanConfig.transfer) {
      delete cleanConfig.transfer.stateFile;
      delete cleanConfig.transfer.checkpoint;
    }

    const result = runCommand(command, args, cleanConfig, envVars, runDir, getMainWindow);
    return { ...result, reportsDir: runDir };
  });

  ipcMain.handle('cli:cancel', () => {
    return cancelCommand();
  });

  // Dialog handlers
  ipcMain.handle('dialog:select-folder', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:select-file', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Reports handlers
  ipcMain.handle('reports:open-folder', (_event, dirPath) => {
    const target = dirPath || getDefaultReportsDir();
    if (fs.existsSync(target)) {
      shell.openPath(target);
    }
    return true;
  });

  ipcMain.handle('reports:list', (_event, dirPath) => {
    const target = dirPath || getDefaultReportsDir();
    // Path traversal guard: resolved path must be within the default reports dir
    // or be the exact dirPath passed from a trusted run result.
    const resolved = path.resolve(target);
    const defaultDir = path.resolve(getDefaultReportsDir()) + path.sep;
    if (!resolved.startsWith(defaultDir) && resolved !== path.resolve(getDefaultReportsDir()) && dirPath) {
      // Allow paths under the user's Documents/CloudVoyager directory tree
      const safeParent = path.resolve(path.join(app.getPath('documents'), 'CloudVoyager'));
      if (!resolved.startsWith(safeParent + path.sep) && resolved !== safeParent) {
        return [];
      }
    }
    if (!fs.existsSync(target)) {
      return [];
    }
    try {
      const files = fs.readdirSync(target, { recursive: true });
      return files
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return ['.json', '.txt', '.md', '.pdf', '.csv'].includes(ext);
        })
        .map(f => {
          const fullPath = path.join(target, f);
          let size = 0;
          try { size = fs.statSync(fullPath).size; } catch {}
          return {
            name: f,
            path: fullPath,
            ext: path.extname(f).toLowerCase(),
            size
          };
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle('reports:read', (_event, filePath, maxLines = 100) => {
    try {
      // Path traversal guard: file must be within known safe directories
      const resolved = path.resolve(filePath);
      const defaultDir = path.resolve(getDefaultReportsDir());
      const safeParent = path.resolve(path.join(app.getPath('documents'), 'CloudVoyager'));
      if (!resolved.startsWith(defaultDir + path.sep) && resolved !== defaultDir &&
          !resolved.startsWith(safeParent + path.sep) && resolved !== safeParent) {
        return null;
      }

      if (!fs.existsSync(filePath)) return null;

      // File size check: skip files larger than 5MB
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) return null;

      // Bounds check maxLines to 1-1000
      const clampedMaxLines = Math.max(1, Math.min(1000, maxLines));

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, clampedMaxLines);
      return lines.join('\n');
    } catch {
      return null;
    }
  });

  // DevTools: screenshot capture for debugging
  ipcMain.handle('devtools:capture', async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    const image = await win.webContents.capturePage();
    const png = image.toPNG();
    const filePath = '/tmp/cloudvoyager-screenshot.png';
    fs.writeFileSync(filePath, png);
    return filePath;
  });

  // App info handlers
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:get-resources-path', () => {
    return process.resourcesPath;
  });

  ipcMain.handle('app:get-default-reports-dir', () => {
    return getDefaultReportsDir();
  });
}

module.exports = { registerIpcHandlers };
