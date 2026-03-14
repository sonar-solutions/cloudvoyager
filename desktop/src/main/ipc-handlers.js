const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadAll, saveAll, loadConfig, saveConfig } = require('./config-store');
const { runCommand, cancelCommand } = require('./cli-runner');

function getDefaultReportsDir() {
  return path.join(app.getPath('documents'), 'CloudVoyager', 'reports');
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

  // CLI handlers
  ipcMain.handle('cli:run', (_event, command, args) => {
    const allConfig = loadAll();
    const isTransfer = ['transfer', 'test', 'validate', 'status', 'reset'].includes(command);
    const config = isTransfer ? allConfig.transferConfig : allConfig.migrateConfig;
    const envVars = allConfig.envVars || {};

    // Determine base reports directory, then create a timestamped subdirectory
    // so each run gets its own folder and old reports aren't overwritten.
    const baseReportsDir = allConfig.reportsDir || getDefaultReportsDir();
    const ts = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19); // e.g. 2026-03-14T15-30-45
    const runDir = path.join(baseReportsDir, `run-${ts}`);
    fs.mkdirSync(runDir, { recursive: true });

    // For migrate/verify, set outputDir to the run-specific directory
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
        .map(f => ({
          name: f,
          path: path.join(target, f),
          ext: path.extname(f).toLowerCase()
        }));
    } catch {
      return [];
    }
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
