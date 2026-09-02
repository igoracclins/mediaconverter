import { app } from 'electron';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const platform = `darwin-${process.arch}`;
const bin = path.resolve(`resources/ffmpeg/${platform}/ffmpeg`);

app.whenReady().then(async () => {
  try {
    const sharp = (await import('sharp')).default;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-sharp-smoke-'));
    const png = path.join(dir, 'src.png');
    const webp = path.join(dir, 'out.webp');
    const avif = path.join(dir, 'out.avif');
    const jpeg = path.join(dir, 'out.jpg');

    const made = spawnSync(
      bin,
      [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=red:size=64x64:d=1',
        '-frames:v',
        '1',
        png,
      ],
      { encoding: 'utf8' },
    );
    if (made.status !== 0) throw new Error(`ffmpeg fixture failed: ${made.stderr}`);
    if (!fs.existsSync(png)) throw new Error('png fixture missing');

    await sharp(png, { limitInputPixels: false }).webp({ quality: 80 }).toFile(webp);
    await sharp(png).avif({ quality: 70 }).toFile(avif);
    await sharp(png).jpeg({ quality: 90 }).toFile(jpeg);

    const meta = await sharp(webp).metadata();
    console.log('SHARP_SMOKE_OK', meta.format, `${meta.width}x${meta.height}`, webp, avif, jpeg);
    app.exit(0);
  } catch (err) {
    console.error('SHARP_SMOKE_FAIL', err);
    app.exit(1);
  }
});
