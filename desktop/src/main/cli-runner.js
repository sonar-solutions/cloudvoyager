const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const os = require('os');

let currentProcess = null;

// PID file path — persists across app restarts so we can kill orphan CLI processes
const PID_FILE = path.join(app.getPath('userData'), 'cli.pid');

function savePid(pid) {
  try { fs.writeFileSync(PID_FILE, String(pid)); } catch { /* ignore */ }
}

function clearPid() {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

/**
 * Kill any orphan CLI process left behind from a previous app session.
 * Called on app startup before any new commands are spawned.
 */
function killOrphan() {
  let pid;
  try {
    pid = Number.parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
  } catch {
    return; // No PID file
  }
  if (!pid || Number.isNaN(pid)) { clearPid(); return; }

  try {
    // Check if process is still alive (signal 0 = existence check)
    process.kill(pid, 0);
    // Still alive — kill it
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F']).on('error', () => {});
    } else {
      try { process.kill(-pid, 'SIGTERM'); } catch { process.kill(pid, 'SIGTERM'); }
      setTimeout(() => {
        try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* dead */ }
      }, 3000);
    }
  } catch {
    // Process already dead — just clean up
  }
  clearPid();
}

function getCliBinaryName() {
  const platform = process.platform;
  const arch = process.arch;

  const map = {
    'linux-x64': 'cloudvoyager-linux-x64',
    'linux-arm64': 'cloudvoyager-linux-arm64',
    'darwin-arm64': 'cloudvoyager-macos-arm64',
    'darwin-x64': 'cloudvoyager-macos-x64',
    'win32-x64': 'cloudvoyager-win-x64.exe',
    'win32-arm64': 'cloudvoyager-win-arm64.exe'
  };

  const key = `${platform}-${arch}`;
  return map[key] || null;
}

function getCliBinaryPath() {
  const binaryName = getCliBinaryName();
  if (!binaryName) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
  }

  // In packaged app, binary is in resources/cli/
  const packagedPath = path.join(process.resourcesPath, 'cli', binaryName);
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  // In development, look in desktop/resources/cli/
  const devPath = path.join(__dirname, '..', '..', 'resources', 'cli', binaryName);
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fallback: try running via node from the parent project
  const fallbackPath = path.join(__dirname, '..', '..', '..', 'src', 'index.js');
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }

  throw new Error(
    `CLI binary not found. Expected: ${binaryName}\n` +
    `Searched:\n  ${packagedPath}\n  ${devPath}\n  ${fallbackPath}`
  );
}

function isNodeScript(binaryPath) {
  return binaryPath.endsWith('.js');
}

function writeTempConfig(config) {
  const tmpDir = app.getPath('temp');
  const configPath = path.join(tmpDir, `cloudvoyager-config-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  return configPath;
}

function runCommand(command, args, config, envVars, reportsDir, getMainWindow) {
  if (currentProcess) {
    throw new Error('A command is already running. Cancel it first.');
  }

  const binaryPath = getCliBinaryPath();
  const configPath = writeTempConfig(config);

  // Build the full argument list
  const fullArgs = [command, '-c', configPath];
  if (args && Array.isArray(args)) {
    fullArgs.push(...args);
  }

  // Determine the working directory for reports
  const cwd = reportsDir || app.getPath('documents');

  // Ensure cwd exists
  if (!fs.existsSync(cwd)) {
    try {
      fs.mkdirSync(cwd, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create working directory ${cwd}: ${err.message}`);
    }
  }

  // Merge environment variables
  const env = { ...process.env, ...envVars };

  // Spawn the process
  let spawnCmd, spawnArgs;
  if (isNodeScript(binaryPath)) {
    // Use system node for the JS fallback — Electron's process.execPath with
    // ELECTRON_RUN_AS_NODE=1 duplicates argv[0] on macOS, breaking Commander's
    // argument parsing.
    spawnCmd = 'node';
    spawnArgs = [binaryPath, ...fullArgs];
  } else {
    spawnCmd = binaryPath;
    spawnArgs = fullArgs;
  }

  const child = spawn(spawnCmd, spawnArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    cwd,
    windowsHide: true,
    detached: process.platform !== 'win32'
  });

  currentProcess = child;
  savePid(child.pid);

  const sendLog = (stream, line) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('cli:log', { stream, line, timestamp: Date.now() });
    }
  };

  // Line-buffered stdout
  const stdoutRL = readline.createInterface({ input: child.stdout });
  stdoutRL.on('line', (line) => sendLog('stdout', line));

  // Line-buffered stderr
  const stderrRL = readline.createInterface({ input: child.stderr });
  stderrRL.on('line', (line) => sendLog('stderr', line));

  child.on('error', (err) => {
    sendLog('stderr', `Failed to start CLI: ${err.message}`);
    stdoutRL.close();
    stderrRL.close();
    cleanup(configPath);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('cli:exit', { code: -1, signal: null, error: err.message });
    }
  });

  child.on('close', (code, signal) => {
    stdoutRL.close();
    stderrRL.close();
    cleanup(configPath);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('cli:exit', { code, signal });
    }
  });

  return { pid: child.pid };
}

function cancelCommand() {
  if (!currentProcess) {
    return false;
  }

  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(currentProcess.pid), '/T', '/F']);
      killer.on('error', () => {}); // Ignore taskkill failures
    } else {
      // Kill the entire process group (negative PID) so child processes also die
      process.kill(-currentProcess.pid, 'SIGTERM');

      // Escalate to SIGKILL if still alive after 5 seconds
      const pid = currentProcess.pid;
      setTimeout(() => {
        try {
          // Check if process group is still alive (signal 0 = existence check)
          process.kill(-pid, 0);
          process.kill(-pid, 'SIGKILL');
        } catch {
          // Already dead — good
        }
      }, 5000);
    }
  } catch {
    // Process may have already exited
  }

  return true;
}

function cleanup(configPath) {
  currentProcess = null;
  clearPid();
  try {
    if (configPath && fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

function isRunning() {
  return currentProcess !== null;
}

module.exports = { runCommand, cancelCommand, killOrphan, isRunning, getCliBinaryPath };
