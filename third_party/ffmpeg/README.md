# Bundled third-party files

This directory holds the license and provenance records for software shipped
outside the node_modules dependency tree.

| File            | Purpose                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `COPYING.GPLv2` | Text of the GNU GPL v2 (the license of the bundled FFmpeg binaries).                        |
| `SOURCE.txt`    | Provenance, verification hashes and the corresponding-source offer for the FFmpeg binaries. |

These files are copied into the application bundle under
`Resources/licenses/ffmpeg/` so every recipient receives the FFmpeg license
and source offer together with the binaries (GPL conveyance requirement).

See `docs/licensing.md` for the full licensing analysis.
