# Third-Party Notices

This document lists the production dependencies bundled by this application. The application runtime is Electron (MIT) plus its Chromium and Node.js components. Media conversion is performed by an external FFmpeg binary licensed under the GNU GPL v2 or later; that binary is distributed as a separate executable and is not part of this dependency tree. See `docs/licensing.md` for the full analysis.

## @img/colour@1.1.0

License: MIT

Source metadata: `node_modules/.pnpm/@img+colour@1.1.0/node_modules/@img/colour/package.json`

## @img/sharp-darwin-arm64@0.35.4

License: Apache-2.0

Source metadata: `node_modules/.pnpm/@img+sharp-darwin-arm64@0.35.4/node_modules/@img/sharp-darwin-arm64/package.json`

## @img/sharp-darwin-x64@0.35.4

License: Apache-2.0

Source metadata: `node_modules/.pnpm/@img+sharp-darwin-x64@0.35.4/node_modules/@img/sharp-darwin-x64/package.json`

## @img/sharp-libvips-darwin-arm64@1.3.3

License: LGPL-3.0-or-later (LGPL obligations apply)

Source metadata: `node_modules/.pnpm/@img+sharp-libvips-darwin-arm64@1.3.3/node_modules/@img/sharp-libvips-darwin-arm64/package.json`

## @img/sharp-libvips-darwin-x64@1.3.3

License: LGPL-3.0-or-later (LGPL obligations apply)

Source metadata: `node_modules/.pnpm/@img+sharp-libvips-darwin-x64@1.3.3/node_modules/@img/sharp-libvips-darwin-x64/package.json`

## @img/sharp-win32-arm64@0.35.4

License: Apache-2.0 AND LGPL-3.0-or-later (LGPL obligations apply)

Source metadata: `node_modules/.pnpm/@img+sharp-win32-arm64@0.35.4/node_modules/@img/sharp-win32-arm64/package.json`

## @img/sharp-win32-x64@0.35.4

License: Apache-2.0 AND LGPL-3.0-or-later (LGPL obligations apply)

Source metadata: `node_modules/.pnpm/@img+sharp-win32-x64@0.35.4/node_modules/@img/sharp-win32-x64/package.json`

## @types/node@24.13.3

License: MIT

Source metadata: `node_modules/.pnpm/@types+node@24.13.3/node_modules/@types/node/package.json`

## detect-libc@2.1.2

License: Apache-2.0

Source metadata: `node_modules/.pnpm/detect-libc@2.1.2/node_modules/detect-libc/package.json`

## semver@7.8.5

License: ISC

Source metadata: `node_modules/.pnpm/semver@7.8.5/node_modules/semver/package.json`

## sharp@0.35.4

License: Apache-2.0

Source metadata: `node_modules/.pnpm/sharp@0.35.4_@types+node@24.13.3/node_modules/sharp/package.json`

## tslib@2.8.1

License: 0BSD

Source metadata: `node_modules/.pnpm/tslib@2.8.1/node_modules/tslib/package.json`

## undici-types@7.18.2

License: MIT

Source metadata: `node_modules/.pnpm/undici-types@7.18.2/node_modules/undici-types/package.json`

## FFmpeg (bundled media engine)

Media conversion delegates to static FFmpeg/ffprobe binaries (configured with `--enable-gpl`), licensed under the GNU GPL v2 or later. They are invoked as separate external executables and are never linked into the application, which remains MIT licensed. The GPL license text and the corresponding-source offer ship in the application bundle under `licenses/ffmpeg/` (COPYING.GPLv2 and SOURCE.txt); downloads are verified by sha256 (pinned in `scripts/ffmpeg/sources.json` for macOS, publisher-provided `checksums.sha256` for the rolling Windows/Linux builds). See `docs/licensing.md` for the full licensing analysis.
