# Sudoku CooCoo

A standalone Svelte 5 SPA with sticky large-number and pencil-number entry,
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

The generated `dist/` directory contains the puzzle data and does not need the
source JSON at runtime. Pasted puzzles remain supported; they may use the
generator's compact 81-digit zero format or nine rows with dots.

## Local history

History records every clean completed bank puzzle, including replays, and shows
the number solved plus the best, average, and slowest times at each difficulty.
New Game still selects distinct uncompleted puzzles first. History stays in
browser storage alongside—but separate from—the single active-game save.
Restarted, unfinished, and pasted custom games are not recorded.
