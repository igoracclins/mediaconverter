import path from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import { app, session } from 'electron';
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

app.whenReady().then(() => {
  setupLogging();
  setupCsp();
  app.setName('Media Converter');

  const platform = currentPlatform();
  const arch = currentArch();
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

  manager = new ConversionManager({ bundle, ffprobeBin });
  const win = createMainWindow();

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
