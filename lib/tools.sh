#!/usr/bin/env bash
# get_tool_info <tool_name> → prints "prop mood side" (space-separated).
# prop is empty string for the default case.

get_tool_info() {
  local tool="$1"
  case "$tool" in
    Edit|Write)             echo "🔧 focused left"   ;;
    Bash)                   echo "🪄 focused right"  ;;
    Grep|Glob|ToolSearch)   echo "🔍 thinking left"  ;;
    Read)                   echo "📖 thinking left"  ;;
    WebFetch|WebSearch)     echo "📡 thinking right" ;;
    Agent)                  echo "🤖 excited right"  ;;
    TodoWrite)              echo "📋 focused left"   ;;
    *)                      echo "none focused none"  ;;
  esac
}
