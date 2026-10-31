CS2 Player Overlay v1.3.11. Premiere Pro 25.6+ UXP panel.
Load manifest.json with UXP Developer Tool. Keep overlay-effects.js, numeric-control.js player-colors.js, still-duration.js player-defaults.js and track-placement.js beside main.js.
See README_TR.txt for usage, trim-following limitations and desktop verification.
No external dependencies. Run checks with Node: node --check main.js;
node --check overlay-effects.js; node tests/overlay-effects.test.js; node tests/numeric-control.test.js; node tests/player-colors.test.js; node tests/still-duration.test.js; node tests/track-placement.test.js
