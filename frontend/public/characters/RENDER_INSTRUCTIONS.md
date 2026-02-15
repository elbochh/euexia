# 🎮 Render Your 3D Models to Sprites

Your 3D model files are ready! Now let's render them to sprite sheets that the game can use.

## ✅ Files Ready
- ✅ `doctor/models/model.fbx` - Doctor character
- ✅ `doctor/models/idle.fbx` - Doctor idle animation
- ✅ `player/models/model.fbx` - Player character  
- ✅ `player/models/idle.fbx` - Player idle animation
- ✅ `player/models/walk.fbx` - Player walking animation

## 🚀 Quick Render (2 Options)

### Option 1: Use Blender (Recommended - Best Quality)

1. **Install Blender** (free): https://www.blender.org/download/

2. **Open Blender** → Delete default cube (X key)

3. **Import Animation File (Character + Animation Together):**
   - File → Import → FBX
   - Navigate to: `frontend/public/characters/player/models/walk.fbx`
   - Click Import
   - **Note:** Mixamo animation files already include the character model, so you get both in one file!

5. **Set Camera to Top-Down:**
   - Press `Numpad 7` (top view)
   - Press `Numpad 0` (camera view)
   - Rotate camera: `R` → `X` → `90` (or drag with middle mouse)
   - Adjust distance: `G` → `Z` → move up/down

6. **Set Render Settings:**
   - Click "Render Properties" tab (camera icon)
   - Set Resolution: 128x128 (or 256x256 for higher quality)
   - Click "Output Properties" tab (folder icon)
   - Set output path: `frontend/public/characters/player/`
   - Set file format: PNG
   - Enable "Transparent" (RGBA)

7. **Render Animation:**
   - Set frame range: 1 to 8 (or more frames)
   - Render → Render Animation
   - Frames save as `0001.png`, `0002.png`, etc.

8. **Combine to Sprite Sheet:**
   - Use online tool: https://www.leshylabs.com/apps/sstool/
   - Upload all frames
   - Set layout: Horizontal (1 row)
   - Download sprite sheet
   - Save as: `frontend/public/characters/player/walk.png`

9. **Repeat for:**
   - Player idle: `player/idle.png`
   - Doctor idle: `doctor/idle.png`

### Option 2: Use Online Tool (Easier but Less Control)

1. Go to: https://spritestack.io (or similar)
2. Upload your FBX model + animation
3. Set camera to top-down
4. Render to sprite sheet
5. Download and save to correct folder

## 📁 Final File Structure

After rendering, you should have:

```
frontend/public/characters/
├── player/
│   ├── idle.png     (sprite sheet: 8+ frames in one image)
│   └── walk.png     (sprite sheet: 8+ frames in one image)
└── doctor/
    └── idle.png     (sprite sheet: 8+ frames in one image)
```

## ✨ That's It!

Once the sprite sheets are in place, **the game will automatically use them!**

The `GameCanvas` component already supports sprite sheets - just refresh your game and you'll see your 3D characters rendered as beautiful sprites!

## 🎯 Tips

- **Frame Count**: 8-12 frames per animation is usually enough
- **Size**: 128x128 or 256x256 pixels per frame
- **Top-Down View**: Make sure camera looks straight down (like Clash of Clans)
- **Transparent Background**: Important for clean sprites!

