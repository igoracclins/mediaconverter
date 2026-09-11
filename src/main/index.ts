import path from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import { app, crashReporter, Menu, session } from 'electron';
import { createEngineBundle } from '@conversion/service';
import { currentArch, currentPlatform } from '@platform/info';
import { logger } from './logger';
import { createMainWindow } from './window';
import { registerIpc } from './ipc/register';
import { ConversionManager } from './services/conversion-manager';

const resourcesBaseDir = !app.isPackaged
  ? path.join(app.getAppPath(), 'resources')
  : process.resourcesPath;

function setupCsp(): void {
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL']);
  const connect = isDev ? "'self' ws://localhost:*" : "'self'";
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connect}`,
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function setupLogging(): void {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    mkdirSync(logsDir, { recursive: true });
    const logFile = path.join(logsDir, 'main.log');
    logger.attachSink((line) => appendFileSync(logFile, line));
  } catch {
    void 0;
  }
}

let manager: ConversionManager | null = null;

app.disableHardwareAcceleration();

crashReporter.start({
  companyName: 'Media Converter',
  productName: 'Media Converter',
  submitURL: 'https://example.invalid',
  uploadToServer: false,
  compress: false,
});

app.whenReady().then(() => {
  setupLogging();
  setupCsp();
  app.setName('Media Converter');

  const platform = currentPlatform();
  const arch = currentArch();

  if (platform === 'win32') {
    Menu.setApplicationMenu(null);
  }

  const ffmpegSuffix = platform === 'win32' ? '.exe' : '';
  const ffmpegBin = `${resourcesBaseDir}/ffmpeg/${platform}-${arch}/ffmpeg${ffmpegSuffix}`;
  const ffprobeBin = `${resourcesBaseDir}/ffmpeg/${platform}-${arch}/ffprobe${ffmpegSuffix}`;
  const bundle = createEngineBundle({
    ffmpegBin,
    ffprobeBin,
  });

  logger.info(
    'main',
    `starting ${app.getName()} v${app.getVersion()} on ${platform}-${arch} (packaged=${app.isPackaged})`,
  );
  logger.info('main', `ffmpeg binary: ${resourcesBaseDir}/ffmpeg/${platform}-${arch}`);
  logger.info('main', `crash dumps: ${app.getPath('crashDumps')}`);

  manager = new ConversionManager({ bundle, ffprobeBin });
  const win = createMainWindow();

  app.on('child-process-gone', (_event, details) => {
    logger.error(
      'main',
      `child process exited unexpectedly type=${details.type} name=${details.name} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });

  let rendererCrashCount = 0;
  let rendererCrashWindowStart = 0;
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || details.reason === 'killed') return;
    const now = Date.now();
    if (now - rendererCrashWindowStart > 60_000) {
      rendererCrashWindowStart = now;
      rendererCrashCount = 0;
    }
    rendererCrashCount += 1;
    if (rendererCrashCount > 3) {
      logger.error(
        'main',
        `renderer crashed repeatedly (${rendererCrashCount} times in a row): reason=${details.reason} exitCode=${details.exitCode}; no more auto-recovery`,
      );
      return;
    }
    logger.error(
      'main',
      `renderer crashed: reason=${details.reason} exitCode=${details.exitCode}; reloading in 1s (attempt ${rendererCrashCount})`,
    );
    setTimeout(() => {
      if (win.isDestroyed()) return;
      void win.webContents.reload();
    }, 1000);
  });

  registerIpc({
    manager,
    resourcesBaseDir,
    ffprobeBin,
    getWindow: () => win,
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  manager?.cancelAll();
});

process.on('uncaughtException', (err) => {
  logger.error('main', `uncaught exception: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  logger.error('main', `unhandled rejection: ${String(reason)}`);
});
