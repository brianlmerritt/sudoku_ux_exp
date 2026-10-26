# Sudoku CooCoo

A standalone Svelte 5 SPA with sticky number and pencil entry,
locally saved progress, and five bank-backed difficulty levels.

Development and production builds embed a puzzle bank at startup. Vite checks,
in order:

1. `SUDOKU_PUZZLES_FILE`
2. `./puzzles.json`
3. the sibling `../genduku/puzzles.json`

```bash
npm install
npm run dev
```

Verify changes with `npm test`, `npm run check`, and `npm run build`.

## Controls

Startup resumes the unfinished puzzle retained by this browser. Otherwise, the level
chooser opens so the player decides which puzzle to start; no puzzle or timer
starts until a level is chosen or a custom puzzle is loaded.

Phones default to the compact Mobile layout: one number pad, a persistent
Number/Pencil switch, and Undo, Redo, Unselect, and Erase icons. Tap the active
digit to switch Number/Pencil; selecting another digit preserves the mode.
The Mobile/Desktop selector restores the separate number and pencil pads;
tapping an already selected tool in Desktop mode does nothing. The layout
preference is saved in this browser. Scrolling remains available on small screens.

Undo and Redo restore complete moves, including removed peer pencil marks.
A new edit clears Redo. Restart, New, and Help stay on one labelled row.
Completed puzzles show a dismissible modal without moving the board.

The generated `dist/` directory contains the puzzle data and does not need the
source JSON at runtime. Pasted puzzles remain supported; they may use the
generator's compact 81-digit zero format or nine rows with dots.

## Local history

History records every completed bank puzzle, including replays and games
completed after a restart, and shows
the number solved plus the best, average, and slowest times at each difficulty.
New Game still selects distinct uncompleted puzzles first. History stays in
browser storage alongside—but separate from—the single active-game save.
Unfinished and pasted custom games are not recorded.

## Install and play offline

After deployment to GitHub Pages, open the game online once to cache the app
and its complete embedded puzzle bank. It can then reopen, resume a puzzle,
and start puzzles at any available level without a connection. Puzzle entries,
elapsed time, Undo/Redo, history, and preferences remain in this browser.

On Android, use the browser menu's **Install app** or **Add to Home screen**.
On iPhone, open the site in Safari, use **Share → Add to Home Screen**, and
enable **Open as Web App** if offered. Launching the icon opens Sudoku CooCoo
without the browser address bar. No app store or additional server is needed.

New versions download in the background and wait until all open game windows
or tabs are closed before activating; an update never forces a reload during
play. Reopen the game to use the new version. Removing browser site data also
removes offline access, the unfinished puzzle, and history.

The manifest, icons, and service worker use relative paths so both a root site
and a GitHub Pages project path work. Deploy the complete `dist/` directory.
Check PWA behavior with `npm run build` and `npm run preview` over localhost
or HTTPS; the development server does not install an offline worker.
Run `npm run test:pwa` to build and verify installation paths, icon sizes,
and coverage and integrity of the offline cache.
