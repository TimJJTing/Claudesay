#!/usr/bin/env bash
# Default ASCII character body parts. Override any variable in
# ~/.claude/claudesay/character.sh — missing vars fall back here.
#
# Grid layout (18 cols × 9 rows total):
#
#   ┌─────┬────────┬─────┐
#   │ TL  │  TOP   │ TR  │  rows 0-1  (TL/TR 5×3, TOP 8×2)
#   │     │  FACE  │     │  row  2    (FACE 8×1)
#   ├─────┼────────┼─────┤
#   │  L  │  BODY  │  R  │  rows 3-5  (L/R 5×3, BODY 8×3)
#   ├─────┼────────┼─────┤
#   │ BL  │  BOT   │ BR  │  rows 6-8  (BL/BR 5×3, BOT 8×3)
#   └─────┴────────┴─────┘
#
# Override CHAR_SIDE_WIDTH, CHAR_CENTER_WIDTH, CHAR_CELL_HEIGHT, or CHAR_TOP_HEIGHT
# in your user character.sh to change grid proportions without touching assembly code.
# Face expression string must be CHAR_CENTER_WIDTH chars wide (parens included).
# All cells are right-padded and bottom-padded automatically — short content is
# forgiving. Trailing blank lines can be omitted; leading blank lines must be
# written. Run `bin/preview.sh` to iterate. Add `--debug` to see cell boundaries.

# ── Cell dimensions ───────────────────────────────────────────────────────────
CHAR_SIDE_WIDTH=5
CHAR_CENTER_WIDTH=8
CHAR_CELL_HEIGHT=3
CHAR_TOP_HEIGHT=2

# ── Faces (8 cols × 1 row, mood-specific, parens included) ───────────────────
CHAR_FACE_HAPPY_A="( ^ᵕ^  )"
CHAR_FACE_HAPPY_B="( ᵕ‿ᵕ  )"
CHAR_FACE_EXCITED_A="( ^▽^  )"
CHAR_FACE_EXCITED_B="( ≧▽≦  )"
CHAR_FACE_THINKING="( ._.  )"
CHAR_FACE_FOCUSED="( -.-  )"
CHAR_FACE_UPSET="( >_<  )"
CHAR_FACE_ERROR="( x_x  )"

# ── Top row (rows 0-2) ───────────────────────────────────────────────────────
CHAR_TOP_LEFT="\
     
     
     "

CHAR_TOP="\
        
 /\__/\\ "

CHAR_TOP_RIGHT="\
     
     
     "

# ── Prop cell templates (side × 3 rows, use single quotes) ──────────────────
# $prop expands to the emoji at render time. Override in your character.sh.
CHAR_PROP_LEFT='\
  ${prop}═
     
     '
CHAR_PROP_RIGHT='\
═${prop}   
     
     '

# ── Middle row (rows 3-5) ────────────────────────────────────────────────────
CHAR_LEFT="\
   ╭╭
   m 
     "

CHAR_BODY="\
( ,,,, )
╭╭....╮╮
||    ||"

CHAR_RIGHT="\
╮╮    
 m   
     "

# ── Bottom row (rows 6-8) ────────────────────────────────────────────────────
CHAR_BOTTOM_LEFT="\
    (
     
     "

CHAR_BOTTOM="\
_)    (_
        
        "

CHAR_BOTTOM_RIGHT="\
)╰~~>
     
     "
