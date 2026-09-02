import { describe, expect, it } from 'vitest';
import { detectPath, splitExtension } from '../detect';

describe('splitExtension', () => {
  it('splits simple names', () => {
    expect(splitExtension('audio.ogg')).toEqual({ base: 'audio', ext: 'ogg' });
    expect(splitExtension('my.video.two.mp4')).toEqual({ base: 'my.video.two', ext: 'mp4' });
  });

  it('treats dotfiles as extensionless', () => {
    expect(splitExtension('.gitignore')).toEqual({ base: '.gitignore', ext: null });
    expect(splitExtension('file.')).toEqual({ base: 'file', ext: null });
  });
});

describe('detectPath', () => {
  it('detects categories', () => {
    expect(detectPath('~/Music/audio.ogg')).toMatchObject({
      category: 'audio',
      extension: 'ogg',
      name: 'audio.ogg',
    });
    expect(detectPath('C:\\Videos\\clip.MP4')).toMatchObject({
      category: 'video',
      extension: 'mp4',
    });
    expect(detectPath('/tmp/photo.JPEG')).toMatchObject({ category: 'image', extension: 'jpeg' });
    expect(detectPath('/x/y/dialog.wma')).toMatchObject({ category: 'audio', extension: 'wma' });
  });

  it('returns null for unsupported, extensionless or empty input', () => {
    expect(detectPath('/tmp/readme.txt')).toBeNull();
    expect(detectPath('/tmp/noext')).toBeNull();
    expect(detectPath('')).toBeNull();
  });
});
