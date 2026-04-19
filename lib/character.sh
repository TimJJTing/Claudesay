#!/usr/bin/env bash
# character.sh — assemble grid character to stdout.
#
# Grid: 9 cells in a 3×3 layout. Side cells CHAR_SIDE_WIDTH × CHAR_CELL_HEIGHT;
# center cells CHAR_CENTER_WIDTH wide. TOP is CHAR_TOP_HEIGHT rows; FACE is 1 row;
# BODY and BOT are CHAR_CELL_HEIGHT rows. Default: 18 cols × 9 rows.
#
# Caller sources characters/default.sh, optional user override, lib/moods.sh,
# then this file, then calls:
#   assemble_character <mood> [prop] [side]
# where side ∈ {left, right} when prop set; prop replaces left or right cell.

# _display_width <string>
# Returns display column count. Adds 1 extra col per 4-byte char (emoji) since
# wc -m counts codepoints but supplementary-plane emoji are 2 cols wide.
_display_width() {
  local s="$1"
  local clen blen
  clen=$(printf '%s' "$s" | wc -m | tr -d ' ')
  blen=$(printf '%s' "$s" | wc -c | tr -d ' ')
  printf '%d' $(( clen + (blen - clen) / 3 ))
}

# _pad_cell <content> <width> <height>
# Right-pads each line to display width and appends blank lines to height.
# Truncates with stderr warning if content exceeds height.
_pad_cell() {
  local content="$1" width="$2" height="$3"
  # Strip one trailing newline so `read -d ''` and `$(...)` capture
  # mechanisms produce the same line count.
  content="${content%$'\n'}"
  local -a lines=()
  local line
  while IFS= read -r line; do
    lines+=("$line")
  done <<< "$content"

  local n=${#lines[@]}
  if (( n > height )); then
    printf 'character.sh: cell exceeds height (%d > %d), truncating\n' "$n" "$height" >&2
    n=$height
  fi

  local i pad
  pad=$(printf '%*s' "$width" "")
  for ((i=0; i<n; i++)); do
    local l="${lines[$i]}"
    local clen
    clen=$(_display_width "$l")
    if (( clen < width )); then
      printf '%s%*s\n' "$l" $((width - clen)) ""
    else
      printf '%s\n' "$l"
    fi
  done
  while (( n < height )); do
    printf '%s\n' "$pad"
    n=$((n+1))
  done
}

# _color_lines <content> <ansi-bg-code>
# When CLAUDESAY_DEBUG_COLORS is set, wrap each line with a background color
# escape so that each cell's footprint (including padding spaces) is visible.
_color_lines() {
  if [[ -z "${CLAUDESAY_DEBUG_COLORS:-}" ]]; then
    printf '%s' "$1"
    return
  fi
  local content="${1%$'\n'}" code="$2" line first=1
  while IFS= read -r line; do
    [[ $first -eq 1 ]] && first=0 || printf '\n'
    printf '\e[%sm%s\e[0m' "$code" "$line"
  done <<< "$content"
}

# _read_lines <var-name> <content>
# Bash-3.2-compatible: read multi-line content into a named array, one line per index.
_read_lines() {
  local var="$1" content="$2" line
  eval "$var=()"
  while IFS= read -r line; do
    eval "$var+=(\"\$line\")"
  done <<< "$content"
}

assemble_character() {
  local mood="${1:-happy}" prop="${2:-}" side="${3:-}"
  local face
  face=$(get_face "$mood")

  local sw=${CHAR_SIDE_WIDTH:-5}
  local cw=${CHAR_CENTER_WIDTH:-8}
  local ch=${CHAR_CELL_HEIGHT:-3}
  local th=${CHAR_TOP_HEIGHT:-2}

  local tl top tr fc lc bc rc bl bt br
  tl=$(_color_lines  "$(_pad_cell "${CHAR_TOP_LEFT:-}"      $sw $ch)" 41)
  top=$(_color_lines "$(_pad_cell "${CHAR_TOP:-}"           $cw $th)" 42)
  tr=$(_color_lines  "$(_pad_cell "${CHAR_TOP_RIGHT:-}"     $sw $ch)" 43)
  fc=$(_color_lines  "$(_pad_cell "$face"                   $cw 1)"  45)
  if [[ -n "$prop" && "$side" == "left" ]]; then
    local _expanded; eval "_expanded=\"${CHAR_PROP_LEFT}\""
    lc=$(_color_lines "$(_pad_cell "$_expanded"             $sw $ch)" 44)
  else
    lc=$(_color_lines "$(_pad_cell "${CHAR_LEFT:-}"         $sw $ch)" 44)
  fi
  bc=$(_color_lines  "$(_pad_cell "${CHAR_BODY:-}"          $cw $ch)" 46)
  if [[ -n "$prop" && "$side" == "right" ]]; then
    local _expanded; eval "_expanded=\"${CHAR_PROP_RIGHT}\""
    rc=$(_color_lines "$(_pad_cell "$_expanded"             $sw $ch)" 101)
  else
    rc=$(_color_lines "$(_pad_cell "${CHAR_RIGHT:-}"        $sw $ch)" 101)
  fi
  bl=$(_color_lines  "$(_pad_cell "${CHAR_BOTTOM_LEFT:-}"   $sw $ch)" 102)
  bt=$(_color_lines  "$(_pad_cell "${CHAR_BOTTOM:-}"        $cw $ch)" 103)
  br=$(_color_lines  "$(_pad_cell "${CHAR_BOTTOM_RIGHT:-}"  $sw $ch)" 105)

  local -a TL TOP TR FC L B R BL BT BR
  _read_lines TL  "$tl"
  _read_lines TOP "$top"
  _read_lines TR  "$tr"
  _read_lines FC  "$fc"
  _read_lines L   "$lc"
  _read_lines B   "$bc"
  _read_lines R   "$rc"
  _read_lines BL  "$bl"
  _read_lines BT  "$bt"
  _read_lines BR  "$br"

  printf '%s%s%s\n' "${TL[0]}" "${TOP[0]}" "${TR[0]}"
  printf '%s%s%s\n' "${TL[1]}" "${TOP[1]}" "${TR[1]}"
  printf '%s%s%s\n' "${TL[2]}" "${FC[0]}"  "${TR[2]}"
  printf '%s%s%s\n' "${L[0]}"  "${B[0]}"   "${R[0]}"
  printf '%s%s%s\n' "${L[1]}"  "${B[1]}"   "${R[1]}"
  printf '%s%s%s\n' "${L[2]}"  "${B[2]}"   "${R[2]}"
  printf '%s%s%s\n' "${BL[0]}" "${BT[0]}"  "${BR[0]}"
  printf '%s%s%s\n' "${BL[1]}" "${BT[1]}"  "${BR[1]}"
  printf '%s%s%s\n' "${BL[2]}" "${BT[2]}"  "${BR[2]}"
}
