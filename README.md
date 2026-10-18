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

Startup restores an unfinished saved game. Without a saved game, the level
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
