export type NodePlatform = 'darwin' | 'win32' | 'linux';
export type NodeArch = 'arm64' | 'x64';

export function platformArchKey(platform: NodePlatform, arch: NodeArch): string {
  return `${platform}-${arch}`;
}

export function currentPlatform(): NodePlatform {
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'win32') return 'win32';
  return 'linux';
}

export function currentArch(): NodeArch {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

export function executableSuffix(platform: NodePlatform): string {
  return platform === 'win32' ? '.exe' : '';
}
