#!/usr/bin/env bash
# get_face <mood> → prints the face string for that mood.
# Positive moods rotate between two variants using seconds-mod-2.

get_face() {
  local mood="$1"
  local variant=$(( $(date +%s) % 2 ))

  case "$mood" in
    happy)
      [[ $variant -eq 0 ]] \
        && echo "${CHAR_FACE_HAPPY_A:-( ^ᵕ^  )}" \
        || echo "${CHAR_FACE_HAPPY_B:-( ᵕ‿ᵕ  )}"
      ;;
    excited)
      [[ $variant -eq 0 ]] \
        && echo "${CHAR_FACE_EXCITED_A:-( ^▽^  )}" \
        || echo "${CHAR_FACE_EXCITED_B:-( ≧▽≦  )}"
      ;;
    thinking) echo "${CHAR_FACE_THINKING:-( -.-  )}" ;;
    focused)  echo "${CHAR_FACE_FOCUSED:-( ._.  )}"  ;;
    upset)    echo "${CHAR_FACE_UPSET:-( >_<  )}"    ;;
    error)    echo "${CHAR_FACE_ERROR:-( x_x  )}"    ;;
    *)        echo "${CHAR_FACE_THINKING:-( ._.  )}" ;;
  esac
}
