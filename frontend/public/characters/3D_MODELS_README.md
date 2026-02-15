# 3D Character Models Setup Guide

## ✅ YES! You Can Use 3D Characters!

Your game supports 3D-style characters rendered as 2D sprite sheets. This gives you the **3D look** with **2D performance** - perfect for your top-down map!

---

## 🚀 Quick Start: Download from Mixamo (FREE)

### Step 1: Get Doctor Character
1. Go to **https://www.mixamo.com** (Adobe's free 3D character library)
2. Click **Characters** tab
3. Search for **"doctor"** or browse medical characters
4. Select a character you like
5. Click **Download** → Choose **FBX** format
6. Save the model file

### Step 2: Get Doctor Animations
1. Still on Mixamo, click **Animations** tab
2. Search for **"Idle"** → Select one → Click **Download** (FBX)
3. Search for **"Walking"** → Select one → Click **Download** (FBX)
4. You now have: model + idle animation + walk animation

### Step 3: Get Player Character
1. Browse **Characters** → Choose a regular person (male/female)
2. Download the character model (FBX)
3. Download **"Idle"** and **"Walking"** animations
4. Same process as doctor!

---

## 🎨 Render 3D Models to Sprite Sheets

### Option A: Use the Built-in Web Tool (Easiest!)
1. Open `http://localhost:3000/3d-sprite-renderer.html` (after starting dev server)
2. Upload your 3D model (FBX/GLB)
3. Upload animation file (optional)
4. Click **"Render Sprite Sheet"**
5. Download the sprite sheet PNG
6. Save to: `frontend/public/characters/[player|doctor]/idle.png` or `walk.png`

### Option B: Using Blender (Free, More Control)
1. Install Blender: https://www.blender.org/download/
2. Open Blender → **File → Import → FBX**
3. Import your character model
4. Set camera to **Top-Down** view:
   - Press `Numpad 7` (top view)
   - Rotate camera to look down at character
5. Set render settings:
   - **Output**: PNG, Transparent background
   - **Resolution**: 128x128 or 256x256 per frame
6. Render animation frames:
   - **Render → Render Animation**
   - Frames will save as `frame_0001.png`, `frame_0002.png`, etc.
7. Combine frames into sprite sheet:
   - Use ImageMagick: `montage frame_*.png -tile 8x1 -geometry +0+0 spritesheet.png`
   - Or online tool: https://www.leshylabs.com/apps/sstool/

### Option C: Online Tools
- **SpriteStack**: https://spritestack.io (Upload 3D model, auto-render)
- **Aseprite**: https://www.aseprite.org (For sprite sheet creation)

### Option D: Pre-rendered Sprites (Fastest)
Search for ready-made sprite sheets:
- "Clash of Clans style character sprites"
- "Top-down RPG character sprites"
- "Isometric character sprite sheets"
- Download and use directly!

---

## 📁 File Structure After Setup

```
frontend/public/characters/
├── player/
│   ├── idle.png        (sprite sheet with 8+ frames)
│   └── walk.png        (sprite sheet with 8+ frames)
└── doctor/
    ├── idle.png
    └── walk.png
```

**OR** use numbered frames:
```
frontend/public/characters/
├── player/
│   ├── idle_0.png
│   ├── idle_1.png
│   ├── idle_2.png
│   └── ...
└── doctor/
    ├── walk_0.png
    ├── walk_1.png
    └── ...
```

---

## ✨ Integration

**The game automatically detects and uses your sprite sheets!**

The `GameCanvas` component already supports:
- ✅ Sprite sheets (single PNG with multiple frames)
- ✅ Numbered frame sequences (`idle_0.png`, `idle_1.png`, ...)
- ✅ JSON sprite sheet definitions
- ✅ SVG fallbacks

Just place your files in the correct folders and they'll be used automatically!

---

## 🎯 Recommended Workflow

1. **Download from Mixamo** (5 minutes)
   - Get doctor character + idle/walk animations
   - Get player character + idle/walk animations

2. **Render to Sprites** (10 minutes)
   - Use the web tool at `/3d-sprite-renderer.html`
   - Or use Blender for more control

3. **Place in Game** (1 minute)
   - Save sprite sheets to `frontend/public/characters/[player|doctor]/`
   - Refresh the game - characters update automatically!

---

## 💡 Tips

- **Top-down view**: Make sure camera looks down at character (like Clash of Clans)
- **Frame count**: 8-12 frames per animation is usually enough
- **Size**: 128x128 or 256x256 pixels per frame works well
- **Transparent background**: Important for clean sprites!
- **Consistent style**: Use similar characters for player and doctor for cohesive look

