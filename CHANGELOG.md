# Changelog

User-facing notes for each release. The release workflow publishes the section
that matches the tag as the GitHub release description, so write these for
players, not for developers.

## [Unreleased]

**Fixes**
- Songs listed twice with the same chart (such as #786 / #790 ときめきエクスペリエンス！ (月島まりなver.)) now play from whichever copy the game has downloaded.
- When a chart can't be found, the message now says why: the song isn't in the extracted assets yet (play or preview it once in the game, then extract again), or which difficulties it does have.

## [3.7.1] - 2026-10-17

**Display fixes**
- Project Sekai **MASTER** badges in the search results now have their color.
- Settings: humanization values show **blue when set and gray when OFF** (the colors were reversed).
- The search box's ✕ button only appears once you have typed something.
- When a jacket image can't be loaded, the "no artwork" placeholder is shown instead of a broken image.
- Device list buttons no longer flash untranslated labels on startup.
- Light theme: the highlight on the device card no longer leaves a dark border behind.

**Behavior fixes**
- Switching from Project Sekai back to BanG Dream with APPEND selected now selects EXPERT instead of nothing.
- When a song lacks the selected difficulty, the selection always moves to one it has.
- **Extract Assets** with an empty path asks for the folder instead of saying "select a song".
- Network errors in Settings and on the play page are now reported instead of silently ignored.

> Internally the GUI frontend was reorganized into small modules and its styles were cleaned up (no visual changes besides the fixes above).

## [3.7.0] - 2026-09-28

**Core**
- Updated to the latest upstream ssm core (kvarenzn/ssm).
- Command-line mode now behaves exactly like upstream ssm.

**Playback**
- Fixed two songs occasionally loading at the same time when you pressed Load right as a song finished (or while Restart was re-arming it).
- If the screen connection fails to start, or an unexpected error happens while a song is loading, the page now shows the error instead of hanging or closing the program.
- Slide notes with position jitter now move smoothly between points.

**Song list, devices & extraction**
- The song list no longer waits forever on a stalled network (30-second timeout), and a broken download (e.g. a Wi-Fi login page) no longer replaces the saved offline copy.
- **Extract Assets** now tells you when the folder doesn't exist, instead of reporting success.
- Saving a device now reports when the settings file can't be written, and requires a serial, width and height.

> Internally this release reorganized the GUI code so upstream updates merge cleanly, and added tests for the GUI server. If anything seems off with adb/HID playback, please open an issue.

## [3.6.1] - 2026-06-03

**Playback**
- The **Stop** button is now **Restart** (↻): it re-arms the current song so you can press Start again — no need to re-load the song.
- The page now tells you when the connection to the backend drops and when it reconnects, instead of looking frozen.

**Song selection & search**
- The search box shows a **"Loading song list…"** state on first use, and a clear error if the list can't be fetched.
- Typing a **Song ID** directly now shows the song's **real title** and only the **difficulties it actually has**; clearing the field clears the selection.

**Stability (crash fixes)**
- Fixed a crash when starting **HID** with a device that has no saved resolution.
- Fixed a crash on charts with no playable notes.
- Fixed a resource leak when stopping/closing the screen connection repeatedly.
- Fixed a possible crash from editing devices in Settings while a song is loading.

**Docs**
- Quick Start now includes the **Extract Assets** step (pull game data → Extract).

> Internally this release also unified the GUI/CLI playback code and added a frontend test suite. If anything seems off with adb/HID playback, please open an issue.
