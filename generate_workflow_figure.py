"""
Euexia Agentic Workflow Figure — compact, vertical agents, large fonts.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from PIL import Image
import numpy as np, os

BASE = os.path.dirname(os.path.abspath(__file__))

# Palette
BG = "#FFFFFF"
CARD = "#F8FAFC"
BORDER = "#E2E8F0"
BLUE, PURPLE, GREEN, AMBER = "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"
ROSE, CYAN = "#F43F5E", "#06B6D4"
DARK, MUT = "#1E293B", "#64748B"
ARR = "#94A3B8"

def load(n):
    p = os.path.join(BASE, n)
    return Image.open(p).convert("RGBA") if os.path.exists(p) else None

def logo(ax, img, xy, z=0.08):
    if img: ax.add_artist(AnnotationBbox(OffsetImage(np.array(img), zoom=z, interpolation="lanczos"), xy, frameon=False, zorder=10))

def bx(ax, xy, w, h, fc=CARD, ec=BORDER, lw=1.5, r=0.006):
    ax.add_patch(mpatches.FancyBboxPatch(xy, w, h, boxstyle=f"round,pad={r}", facecolor=fc, edgecolor=ec, linewidth=lw, zorder=2))

def ar(ax, s, e, c=ARR, lw=2, rad=0):
    ax.annotate("", xy=e, xytext=s, arrowprops=dict(arrowstyle="-|>", color=c, lw=lw, connectionstyle=f"arc3,rad={rad}"), zorder=3)

def T(ax, x, y, s, sz=10, c=DARK, w="normal", ha="center", va="center"):
    # Global text upscale for better readability in the exported PNG
    ax.text(x, y, s, fontsize=sz * 1.22, color=c, fontweight=w, ha=ha, va=va, zorder=5, fontfamily="sans-serif", linespacing=1.3)

fig, ax = plt.subplots(figsize=(20, 14), dpi=300)
fig.patch.set_facecolor(BG); ax.set_facecolor(BG)
ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

mg = load("medgemma_logo.png"); sm = load("sagemaker_logo.png")
gpt = load("gpt_logo.png"); db = load("mongodb.png")

# ================================================================
# TITLE
# ================================================================
T(ax, 0.5, 0.97, "Euexia  --  Agentic AI Workflow", sz=20, w="bold")
T(ax, 0.5, 0.945, "From consultation upload to gamified care plan & AI doctor chat", sz=11, c=MUT)

# ================================================================
# COLUMN 1: INPUTS (x ~ 0.02)
# ================================================================
ix, iw = 0.02, 0.07
T(ax, ix+iw/2, 0.91, "Patient\nUploads", sz=10, w="bold", c=MUT)

inputs_cfg = [
    ("Voice",  PURPLE, 0.84),
    ("Text",   BLUE,   0.77),
    ("Image",  GREEN,  0.70),
    ("PDF",    AMBER,  0.63),
]
for lbl, clr, yy in inputs_cfg:
    bx(ax, (ix, yy), iw, 0.05, fc=clr+"15", ec=clr, lw=1.5)
    T(ax, ix+iw/2, yy+0.025, lbl, sz=10, c=clr, w="bold")

# ================================================================
# COLUMN 2: 4 AGENTS (stacked vertically)
# ================================================================
ax2 = 0.135; aw = 0.13; ah = 0.065; agap = 0.008

T(ax, ax2+aw/2, 0.925, "Step 1\nParallel Agents", sz=12, w="bold", c=BLUE)

agents = [
    ("Voice Agent",  "ASR + MedGemma 4B",  PURPLE, 0.84),
    ("Text Agent",   "MedGemma 4B Text",   BLUE,   0.77),
    ("Image Agent",  "MedGemma 4B Vision", GREEN,  0.70),
    ("PDF Agent",    "MedGemma 4B Text",   AMBER,  0.63),
]
for name, mdl, clr, yy in agents:
    bx(ax, (ax2, yy), aw, ah, fc=clr+"0A", ec=clr, lw=1.5)
    T(ax, ax2+aw/2, yy+ah-0.017, name, sz=9, w="bold", c=clr)
    T(ax, ax2+aw/2, yy+0.015, mdl, sz=7, c=MUT)
    logo(ax, sm, (ax2+0.02, yy+ah-0.017), z=0.025)
    logo(ax, mg, (ax2+aw-0.025, yy+ah-0.017), z=0.03)

# Arrows input -> agent
for (_, clr_i, yi), (_, _, _, ya) in zip(inputs_cfg, agents):
    ar(ax, (ix+iw, yi+0.025), (ax2, ya+ah/2), c=clr_i, lw=1.5)

# ================================================================
# COLUMN 3: SUMMARY AGENT
# ================================================================
sx, sw, sh = 0.32, 0.12, 0.28
sy = 0.63
bx(ax, (sx, sy), sw, sh, fc=CYAN+"0A", ec=CYAN, lw=2)
T(ax, sx+sw/2, sy+sh-0.02, "Step 2", sz=8, c=MUT, w="bold")
T(ax, sx+sw/2, sy+sh-0.055, "Summary Agent", sz=12, w="bold", c=CYAN)
T(ax, sx+sw/2, sy+sh-0.085, "MedGemma 4B", sz=8, c=MUT)
T(ax, sx+sw/2, sy+sh/2-0.02, "Merges all agent\noutputs into one\ncomprehensive\ncare plan", sz=9, c=MUT)
logo(ax, sm, (sx+0.03, sy+0.025), z=0.035)
logo(ax, mg, (sx+sw-0.03, sy+0.025), z=0.04)

# Arrows agents -> summary
for _, _, clr, ya in agents:
    ar(ax, (ax2+aw, ya+ah/2), (sx, sy+sh/2), c=ARR, lw=1.2)

# Med extractor (small, between agents and summary, below)
mex, mey = ax2 + 0.02, 0.575
bx(ax, (mex, mey), aw-0.04, 0.035, fc=AMBER+"10", ec=AMBER, lw=0.8, r=0.004)
T(ax, mex+(aw-0.04)/2, mey+0.022, "Med Extractor", sz=7, w="bold", c=AMBER)
T(ax, mex+(aw-0.04)/2, mey+0.008, "Rule-based", sz=6, c=MUT)
ar(ax, (mex+aw-0.04, mey+0.018), (sx, sy+0.03), c=AMBER, lw=1)

# ================================================================
# COLUMN 4: CHECKLIST AGENT
# ================================================================
cx, cw, ch = 0.50, 0.12, 0.28
cy = 0.63
bx(ax, (cx, cy), cw, ch, fc=ROSE+"0A", ec=ROSE, lw=2)
T(ax, cx+cw/2, cy+ch-0.02, "Step 3", sz=8, c=MUT, w="bold")
T(ax, cx+cw/2, cy+ch-0.055, "Checklist Agent", sz=12, w="bold", c=ROSE)
T(ax, cx+cw/2, cy+ch-0.085, "GPT-4.1-mini", sz=8, c=MUT)
T(ax, cx+cw/2, cy+ch/2-0.02, "Structures plan into\nJSON events:\nMeds, Appointments,\nTests, Lifestyle", sz=9, c=MUT)
logo(ax, gpt, (cx+cw/2, cy+0.03), z=0.045)

# Arrow summary -> checklist
ar(ax, (sx+sw, sy+sh/2), (cx, cy+ch/2), c=CYAN, lw=2.5)

# ================================================================
# COLUMN 5: MONGODB
# ================================================================
dx, dw, dh = 0.68, 0.10, 0.28
dy = 0.63
bx(ax, (dx, dy), dw, dh, fc=GREEN+"0A", ec=GREEN, lw=2)
T(ax, dx+dw/2, dy+dh-0.02, "Step 4", sz=8, c=MUT, w="bold")
T(ax, dx+dw/2, dy+dh-0.055, "MongoDB", sz=12, w="bold", c=GREEN)
logo(ax, db, (dx+dw/2, dy+dh/2+0.01), z=0.08)
T(ax, dx+dw/2, dy+0.055, "Consultations\nChecklist Items\nChat History\nRAG Chunks", sz=7.5, c=MUT)

# Arrow checklist -> DB
ar(ax, (cx+cw, cy+ch/2), (dx, dy+ch/2), c=ROSE, lw=2.5)

# ================================================================
# COLUMN 6: PATIENT EXPERIENCE
# ================================================================
ox, ow, oh = 0.84, 0.10, 0.28
oy = 0.63
bx(ax, (ox, oy), ow, oh, fc="#F0F9FF", ec=CYAN, lw=2)
T(ax, ox+ow/2, oy+oh-0.03, "Patient", sz=11, w="bold", c=CYAN)
T(ax, ox+ow/2, oy+oh-0.06, "Experience", sz=11, w="bold", c=CYAN)
feats = [("Game Map", AMBER), ("Daily Stars", AMBER), ("Checklist", ROSE),
         ("Leaderboard", GREEN), ("Dr. Chat", PURPLE), ("XP & Coins", CYAN)]
for i, (lbl, clr) in enumerate(feats):
    T(ax, ox+ow/2, oy+oh-0.10-i*0.03, lbl, sz=8, c=clr, w="bold")

# Arrow DB -> Output
ar(ax, (dx+dw, dy+dh/2), (ox, oy+dh/2), c=GREEN, lw=2)

# ================================================================
# ROW 2: MAP GENERATOR + RAG CHAT (moved up to reduce whitespace)
# ================================================================

# ---- Map Generator ----
mpx, mpy, mpw, mph = 0.62, 0.31, 0.16, 0.20
bx(ax, (mpx, mpy), mpw, mph, fc=AMBER+"0A", ec=AMBER, lw=1.8)
T(ax, mpx+mpw/2, mpy+mph-0.02, "Step 5", sz=8, c=MUT, w="bold")
T(ax, mpx+mpw/2, mpy+mph-0.055, "Map Generator", sz=12, w="bold", c=AMBER)
T(ax, mpx+mpw/2, mpy+mph-0.085, "Algorithmic (no AI)", sz=8, c=MUT)
T(ax, mpx+mpw/2, mpy+mph/2-0.03, "Hex-tile game map\nwith seasonal biomes.\nOne star per day.", sz=9, c=MUT)

# Arrow DB -> Map
ar(ax, (dx+dw/2, dy), (mpx+mpw/2, mpy+mph), c=GREEN, lw=2, rad=-0.15)

# Arrow Map -> Output
ar(ax, (mpx+mpw, mpy+mph/2), (ox+ow/2, oy), c=AMBER, lw=1.8, rad=-0.2)

# ---- RAG Chat Pipeline ----
rx, ry, rw, rh = 0.05, 0.31, 0.50, 0.20
bx(ax, (rx, ry), rw, rh, fc=PURPLE+"06", ec=PURPLE, lw=1.8)
T(ax, rx+rw/2, ry+rh-0.025, "Step 6  --  Dr. Gemma Chat (RAG Pipeline)", sz=12, w="bold", c=PURPLE)

# Sub-boxes
sbw, sbh = 0.14, 0.105
sby = ry + 0.03

s1x = rx + 0.02
bx(ax, (s1x, sby), sbw, sbh, fc=BLUE+"0A", ec=BLUE, lw=1, r=0.005)
T(ax, s1x+sbw/2, sby+sbh-0.02, "Question", sz=9, w="bold", c=BLUE)
T(ax, s1x+sbw/2, sby+sbh-0.045, "Condenser", sz=9, w="bold", c=BLUE)
T(ax, s1x+sbw/2, sby+0.03, "Resolves follow-ups\nMedGemma 4B", sz=7.5, c=MUT)
logo(ax, sm, (s1x+0.03, sby+0.01), z=0.025)

s2x = rx + 0.18
bx(ax, (s2x, sby), sbw, sbh, fc=GREEN+"0A", ec=GREEN, lw=1, r=0.005)
T(ax, s2x+sbw/2, sby+sbh-0.02, "Context", sz=9, w="bold", c=GREEN)
T(ax, s2x+sbw/2, sby+sbh-0.045, "Retriever", sz=9, w="bold", c=GREEN)
T(ax, s2x+sbw/2, sby+0.03, "Vector + MMR\nfrom MongoDB", sz=7.5, c=MUT)

s3x = rx + 0.34
bx(ax, (s3x, sby), sbw, sbh, fc=CYAN+"0A", ec=CYAN, lw=1, r=0.005)
T(ax, s3x+sbw/2, sby+sbh-0.02, "Response", sz=9, w="bold", c=CYAN)
T(ax, s3x+sbw/2, sby+sbh-0.045, "Generator", sz=9, w="bold", c=CYAN)
T(ax, s3x+sbw/2, sby+0.03, "Generates answer\nMedGemma 4B", sz=7.5, c=MUT)
logo(ax, sm, (s3x+0.035, sby+0.01), z=0.025)
logo(ax, mg, (s3x+sbw-0.035, sby+0.01), z=0.03)

# Inner arrows
ar(ax, (s1x+sbw, sby+sbh/2), (s2x, sby+sbh/2), c=BLUE, lw=1.5)
ar(ax, (s2x+sbw, sby+sbh/2), (s3x, sby+sbh/2), c=GREEN, lw=1.5)

# Arrow DB -> RAG
ar(ax, (dx+dw/2, dy), (rx+rw, ry+rh/2), c=GREEN, lw=1.5, rad=0.3)

# Arrow inputs -> RAG (user question)
ar(ax, (ix+iw/2, inputs_cfg[-1][2]), (rx, ry+rh/2), c=CYAN, lw=1.3, rad=-0.08)
T(ax, 0.03, 0.60, "User\nquestion", sz=7, c=MUT)

# Arrow RAG -> Output
ar(ax, (rx+rw, ry+rh/2), (ox+ow/2, oy), c=PURPLE, lw=1.8, rad=-0.15)

# ================================================================
# LEGEND (larger and clearer top-right labels)
# ================================================================
lx, ly = 0.79, 0.905
bx(ax, (lx, ly), 0.20, 0.065, fc=CARD, ec=BORDER, lw=0.9, r=0.004)
T(ax, lx + 0.10, ly + 0.053, "Model Legend", sz=7.8, c=DARK, w="bold")
logo(ax, sm, (lx+0.016, ly+0.035), z=0.024)
logo(ax, mg, (lx+0.046, ly+0.035), z=0.030)
T(ax, lx+0.075, ly+0.035, "= MedGemma 4B on SageMaker", sz=7.0, c=MUT, ha="left")
logo(ax, gpt, (lx+0.016, ly+0.015), z=0.022)
T(ax, lx+0.046, ly+0.015, "= GPT-4.1-mini (OpenAI)", sz=7.0, c=MUT, ha="left")

# Save
out = os.path.join(BASE, "agentic_workflow.png")
fig.savefig(out, dpi=300, bbox_inches="tight", facecolor=BG, pad_inches=0.1)
plt.close(fig)
print(f"Saved: {out}")
