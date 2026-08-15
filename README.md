# Sudoku Desk

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

## Local progress

Completed bank puzzles award one to five points from Easy through Very Hard.
Each puzzle scores only once; a replay can improve its personal-best time but
cannot add more points. New Game selects uncompleted puzzles first. Completion
counts, scores, and best times stay in browser storage alongside—but separate
from—the single active-game save. Restarted and unfinished games are ignored.
