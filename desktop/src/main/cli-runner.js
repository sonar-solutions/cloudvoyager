const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const os = require('os');

let currentProcess = null;

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
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
    windowsHide: true
  });

  currentProcess = child;

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

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(currentProcess.pid), '/T', '/F']);
  } else {
    currentProcess.kill('SIGTERM');
  }

  return true;
}

function cleanup(configPath) {
  currentProcess = null;
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

module.exports = { runCommand, cancelCommand, isRunning, getCliBinaryPath };
