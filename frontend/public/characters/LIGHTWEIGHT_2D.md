# Lightweight 2D Characters (recommended)

The game **prefers 2D assets** over 3D FBX to keep load fast and avoid heavy (~50MB) models.

## What the game uses

1. **Static 2D first** – For each character/animation it looks for:
   - `player/idle.png`, `player/walk.png`
   - `doctor/idle.png`, `doctor/walk.png`
   - Same paths with `.svg` are tried if `.png` is missing.

2. **Format**
   - **Single image**: one PNG or SVG (e.g. 128×128). Used as 1 frame (no animation).
   - **8-frame sheet**: one PNG with 8 frames in a row (width ≥ 4× height). Used as idle/walk animation.

3. **Included by default** – This repo includes lightweight SVG placeholders:
   - `player/idle.svg`, `player/walk.svg` (person with backpack/badge)
   - `doctor/idle.svg`, `doctor/walk.svg` (white coat, stethoscope, DR badge)
   So the game uses these and **does not load any FBX** unless you remove the SVGs.

## Optional: better-looking PNG sprite sheets

If you want higher-quality 2D sprites (doctor + normal person), you can add PNGs and keep things lightweight:

| Source | What | License | Notes |
|--------|------|---------|--------|
| [Kenney – Character / Shape packs](https://kenney.nl/assets) | 2D character sprites | CC0 | Free, no attribution. Pick a character sheet and export as 8-frame horizontal PNG if needed. |
| [Universal LPC Spritesheet](https://github.com/makrohn/Universal-LPC-spritesheet) | Humanoid characters, many animations | GPL3 / CC-BY-SA | Includes walk/idle; can use a “doctor” style or civilian. |
| [Kenney Shape Characters](https://kenney-assets.itch.io/shape-characters) | Geometric 2D characters | CC0 | Lightweight, good for a stylized look. |
| [Doctor pixel pack (itch.io)](https://free-game-assets.itch.io/doctors-pixel-art-character-sprite-sheets-pack) | Doctor-themed pixel sprites | Check itch page | 3 variants; export as PNG sprite sheet. |

**Where to put files**

- Player: `frontend/public/characters/player/idle.png`, `walk.png` (or keep `idle.svg` / `walk.svg`).
- Doctor: `frontend/public/characters/doctor/idle.png`, `walk.png` (or keep the existing `.svg`).

If you add PNGs, the game will use them instead of the SVGs (and will never load FBX for that slot). Use 8 frames in a row for smooth animation, or a single image for a static character.
