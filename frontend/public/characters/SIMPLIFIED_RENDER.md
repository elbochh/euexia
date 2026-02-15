# 🎯 Simplified: Render Your Mixamo Animations

## ✅ What You Have

Mixamo animation files **already include the character model**, so each file is complete:

- `player/models/walk.fbx` → **Player character + Walking animation** ✅
- `player/models/idle.fbx` → **Player character + Idle animation** ✅  
- `doctor/models/idle.fbx` → **Doctor character + Idle animation** ✅

**You don't need the separate `model.fbx` files** - the animation files have everything!

## 🚀 Render in Blender (Super Simple)

### For Each Animation File:

1. **Open Blender** → Delete default cube (X key)

2. **Import ONE file:**
   ```
   File → Import → FBX
   → Select: frontend/public/characters/player/models/walk.fbx
   → Click Import
   ```
   **That's it!** Character + animation are both loaded.

3. **Set Top-Down Camera:**
   - `Numpad 7` (top view)
   - `Numpad 0` (camera view)  
   - Rotate: `R` → `X` → `90` (or middle mouse)
   - Adjust height: `G` → `Z`

4. **Render Settings:**
   - Resolution: 128x128 (or 256x256)
   - Output: PNG, Transparent
   - Output path: `frontend/public/characters/player/`

5. **Render Animation:**
   - Frame range: 1 to 8
   - Render → Render Animation
   - Saves: `0001.png`, `0002.png`, etc.

6. **Combine to Sprite Sheet:**
   - https://www.leshylabs.com/apps/sstool/
   - Upload all frames → Horizontal layout
   - Download → Save as `walk.png`

7. **Repeat for:**
   - `idle.fbx` files → `idle.png`

## 📁 Final Result

```
frontend/public/characters/
├── player/
│   ├── walk.png  (8 frames in one image)
│   └── idle.png  (8 frames in one image)
└── doctor/
    └── idle.png  (8 frames in one image)
```

**Done!** The game will automatically use these sprite sheets! 🎮



