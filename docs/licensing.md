# Licensing

How Media Converter is licensed and how its bundled components affect
that license. The application itself is **MIT**; the FFmpeg binaries it ships
are **GPL v2 or later**, which is acceptable because they run as separate
external executables and are never linked into the app.

## 1. The application — MIT

The source code of Media Converter is MIT licensed ([LICENSE](../LICENSE)).
Nothing in the project's own code is copyleft.

## 2. FFmpeg — GPL v2 or later, as an external executable

### What is shipped

Static `ffmpeg`/`ffprobe` binaries under `resources/ffmpeg/<plat>-<arch>/`,
fetched by `pnpm ffmpeg:prepare` (see [ffmpeg.md](ffmpeg.md)). In the
distributed app they live in `Contents/Resources/ffmpeg/` (macOS) or
`resources/ffmpeg/` (Windows/Linux).

### Why the build is GPL

The format matrix requires software encoding to **H.264** (MP4/MOV/MKV via
`libx264`) and H.265 (via `libx265`, MKV). `libx264` and `libx265` are
GPL-licensed, so a static binary statically linking them is a GPL work. The
installed binaries were deliberately chosen as **GPL builds** for full codec
coverage: osxexperts.net (macOS) and BtbN/FFmpeg-Builds (Windows/Linux), all
configured with `--enable-gpl`. You can confirm this on any shipped binary with:

```sh
ffmpeg -buildconf | grep -E 'enable-gpl|libx264|libx265'
```

Per the FFmpeg project ("FFmpeg ... covered by the GNU General Public License
(License) version 2 or later" once GPL parts are used, [ffmpeg.org/legal.html](https://www.ffmpeg.org/legal.html)),
a `--enable-gpl` binary is **GPL v2 or later**.

### Why this should not make the app GPL

The app never links, embeds or `dlopen`s FFmpeg code. It invokes the binaries
as subprocesses (CLI argv + pipes) — the classic "separate works"/aggregation
model. This is the same distribution model used by many MIT/Apache/Business-
Source apps that shell out to FFmpeg.

> The characterization above is an **engineering position based on the chosen
> architecture**, not a legal assurance. Whether a given distribution is a
> "combined work" or "mere aggregation" under the GPL can turn on facts and is
> ultimately a legal question. We designed the app to be a separate work and do
> not link FFmpeg code, which is the strongest defensible posture for keeping the
> application MIT; the definitive characterization of a specific distribution
> should be confirmed with professional legal review before commercial release.

### Obligations we honor as distributor of the binaries

The GPL obligations attach to the _binary_ we redistribute, not to the app:

1. **License text with the binaries** — `third_party/ffmpeg/COPYING.GPLv2`
   (verbatim GNU GPL v2) is copied into the app bundle under
   `Contents/Resources/licenses/ffmpeg/`.
2. **Corresponding source offer** — `third_party/ffmpeg/SOURCE.txt` records the
   exact provenance (URLs + sha256 per platform), points to the matching
   upstream source (`https://ffmpeg.org/releases/…` and BtbN build repo) and
   includes a written offer on request. Shipped alongside the license text.
3. **Binaries are unmodified** — verified by sha256 at install time
   (`scripts/ffmpeg/sources.json`).

> Note: the obligations travel with the FFmpeg binaries. Anyone who extracts
> and redistributes those binaries inherits them. The app's own source does not.

## 3. sharp / libvips

- `sharp` is **Apache-2.0**.
- `sharp` dynamically loads prebuilt **libvips** binaries, which are
  **LGPL-3.0-or-later**. LGPL permits linking with a permissive app on
  condition that recipients get the notices and a relink path for modified
  libvips. We record this in `THIRD-PARTY-NOTICES.md` and do not statically fold
  GPL code into it.
- `pnpm licenses:check` warns (does not fail) on LGPL packages.

## 4. Other dependencies

npm production dependencies are audited by `scripts/licenses/audit.mjs`
(`pnpm licenses:check`), which hard-fails on GPL/AGPL/SSPL/BUSL and produces
`THIRD-PARTY-NOTICES.md`. All packaged production packages are currently
MIT/ISC/BSD/Apache (2.0).

## 5. Decision log: why not an LGPL FFmpeg build?

LGPL builds were assessed as an alternative before pinning GPL. An LGPL build
would drop the GPL-only encoders.

**Candidate:** [serversideup/ffmpeg-lgpl-builds](https://github.com/serversideup/ffmpeg-lgpl-builds)
publishes reproducible, multi-arch binaries built `--disable-gpl --disable-nonfree
--disable-version3` (so LGPL-2.1), with hardware encoders on macOS (VideoToolbox
`h264_videotoolbox`/`hevc_videotoolbox`, OpenSSL-static TLS).

**Verified against the actual binary** (`ffmpeg-8.1.2-aarch64-apple-darwin`):

| Capability our matrix needs                   | GPL builds (current) | serversideup LGPL build                                                  |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Software H.264 / HEVC (`libx264`/`libx265`)   | ✅                   | ❌ absent                                                                |
| MP3 (`libmp3lame`)                            | ✅                   | ❌ absent                                                                |
| WebM/VP9 (`libvpx`) + Opus (`libopus`)        | ✅                   | ❌ absent                                                                |
| OGG/Vorbis (`libvorbis`)                      | ✅                   | ❌ absent                                                                |
| PNG / WEBP / AV1 (libwebp, libsvtav1, libaom) | ✅                   | ❌ absent (only `mjpeg`)                                                 |
| AAC / FLAC / PCM / hardware encoders          | ✅                   | partial (`aac`, `aac_at`, `flac`, `pcm*`, `h264/hevc_videotoolbox` only) |

The LGPL build therefore **cannot convert to MP3, WEBM, OGG or PNG** and has no
software H.264/HEVC — it cannot satisfy the V1 format matrix on any target
(Windows/Linux variants are similarly minimal: NVENC/AMF/QSV/openh264 + AAC).

**Conclusion:** GPL static builds are required while the matrix includes MP3,
WebM, OGG and software H.264/HEVC encoding. The app stays MIT because FFmpeg is
only ever executed as a subprocess.

**Future option:** if the format matrix ever drops those outputs (or accepts
hardware-encoder-only paths), switching to an LGPL build (e.g. serversideup's,
or the `-lgpl` variants of BtbN) removes GPL obligations entirely and the
distributor burden shrinks to LGPL §6 (source pointer). Re-evaluate per release;
the switch is confined to `scripts/ffmpeg/sources.json` + `ffmpeg.md`.

## 6. Compliance checklist

- [x] App code MIT (`LICENSE`).
- [x] FFmpeg GPL-2.0-or-later text shipped in bundle (`licenses/ffmpeg/COPYING.GPLv2`).
- [x] FFmpeg corresponding-source offer shipped (`licenses/ffmpeg/SOURCE.txt`).
- [x] FFmpeg binaries unmodified, sha256-verified at prepare time.
- [x] libvips LGPL notice present in `THIRD-PARTY-NOTICES.md`.
- [x] License audit as a CI gate (`pnpm licenses:check`).
- [x] FFmpeg-is-an-external-process and codec-patent notice published for end
      users (`NOTICE.md`, README).
- [x] Contributor license terms documented (`CONTRIBUTING.md`).
- [ ] Regenerate `THIRD-PARTY-NOTICES.md` whenever a dependency changes
      (`pnpm licenses:check -- --write THIRD-PARTY-NOTICES.md`).
- [ ] Patent exposure of specific codecs (e.g. H.264/AAC pools) is reviewed for
      commercial distribution — the FFmpeg project licenses no patents.

## 7. Pending legal/commercial review (NOT resolved)

The items below are engineering facts intentionally recorded so they are not
misread as "handled". Each needs legal/commercial review before **public /
commercial distribution** of the app is treated as approved. None of these are
claimed to be resolved.

### 7.1 Codec patents / licensing pools

- **H.264 (MP4/MOV/MKV output via `libx264`)** — subject to the AVC patent
  pool (MPEG-LA / Via Licensing), licensed for "programs" on a per-unit basis;
  small-indicator/calculation and third-party-liability nuances exist. Whether
  our distribution model needs a license is a legal question; FFmpeg itself
  licenses no patents and provides no proxy.
- **AAC (MP4/M4A output)** — covered by the MPEG-4 audio patent pool
  (Via Licensing). Same review applies.
- **VP9 (WebM via `libvpx`)** — widely considered royalty-free, but not
  routinely opined as such; confirm at distribution time.
- **Others (MP3 — expired/cleared pools; FLAC/Opus/Vorbis — patent-free)**
  are generally not a concern but change independently of this document.

### 7.2 Exact binary license version

The shipped binaries are built `--enable-gpl`, documented here as **GPL v2 or
later**. The exact text _shipped alongside them_ is `COPYING.GPLv2` (GPL v2
only). A downstream redistribution that must convey specific version terms
should confirm, per upstream build, whether "v2 only" or "v2 or later" applies,
and ship the matching license grant. This document relies on the FFmpeg project
statement, not on U.S. legal advice.

### 7.3 libvips / sharp LGPL implications

`sharp` loads prebuilt **libvips (LGPL-3.0-or-later)** as a dynamically loaded
native library. LGPL requires that recipients can relink against a modified
libvips. We record the notice but do not currently ship libvips source or a
relink mechanism. Whether that is sufficient for our distribution model is a
legal question that should be reviewed before commercial distribution.

### 7.4 appId placeholder / trademarks

- `electron-builder.yml` uses `appId: com.example.mediaconverter`, a **placeholder**.
  It must become a real reverse-DNS identifier owned by the project before
  public release (macOS bundle id, code signing, and Windows app identity all
  derive from it). See [packaging.md](packaging.md) / release blockers.
- Project name "Media Converter" and any logo are **not** trademark-cleared;
  verify before public/commercial use.
- The distribution is unsigned and un-notarized (see release blockers); the
  bundle id above is the only identifier today.

### 7.5 Third-party contribution/license surface

Confirm that all bundled production npm packages remain within their declared
permissive licenses at each release; `pnpm licenses:check` gates this but does
not substitute for a release-time legal review of the lockfile.
