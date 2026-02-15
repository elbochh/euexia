# ⚡ Quick Start: Use Your 3D Models

## ✅ Files Are Ready!

Your 3D model files have been moved to the correct locations:
- ✅ `doctor/models/idle.fbx` (contains doctor + idle animation)
- ✅ `player/models/idle.fbx` (contains player + idle animation)
- ✅ `player/models/walk.fbx` (contains player + walking animation)

**Note:** Mixamo animation files already include the character model, so you don't need to import them separately!

## 🎯 Next Step: Render to Sprites

The game needs **sprite sheets** (2D images) from your 3D models. 

### Fastest Method: Blender (10 minutes)

1. **Download Blender**: https://www.blender.org (free)

2. **Import Animation File (Character + Animation Together):**
   ```
   File → Import → FBX
   → Select: frontend/public/characters/player/models/walk.fbx
   → The character AND animation are both imported!
   ```

3. **Set Camera to Top-Down View:**
   - Press `Numpad 7` (top view)
   - Press `Numpad 0` (camera view)
   - Rotate camera: `R` → `X` → `90` (or middle mouse drag)
   - Adjust distance: `G` → `Z` → move up/down
   - Make sure character is centered and visible

4. **Set Render Settings:**
   - Click "Render Properties" tab (camera icon)
   - Set Resolution: 128x128 (or 256x256 for higher quality)
   - Click "Output Properties" tab (folder icon)
   - Set output path: `frontend/public/characters/player/`
   - Set file format: PNG
   - Enable "Transparent" (RGBA)

5. **Render Animation:**
   - Set frame range: 1 to 8 (or 12 for smoother animation)
   - Press `Space` to play animation and preview
   - Render → Render Animation
   - Frames save as `0001.png`, `0002.png`, etc.

6. **Combine to Sprite Sheet:**
   - Use: https://www.leshylabs.com/apps/sstool/
   - Upload all rendered frames
   - Set layout: Horizontal (1 row, all frames side by side)
   - Download sprite sheet
   - Save as: `frontend/public/characters/player/walk.png`

7. **Repeat for:**
   - `player/models/idle.fbx` → `player/idle.png`
   - `doctor/models/idle.fbx` → `doctor/idle.png`

### Alternative: Online Tools

- **SpriteStack**: https://spritestack.io
- Upload FBX → Render → Download sprite sheet

## 🎮 Result

Once sprite sheets are in place:
- `frontend/public/characters/player/idle.png`
- `frontend/public/characters/player/walk.png`  
- `frontend/public/characters/doctor/idle.png`

**The game will automatically use them!** Just refresh and your 3D characters will appear as beautiful sprites in the game!

---

**Need help?** See `RENDER_INSTRUCTIONS.md` for detailed step-by-step guide.

