#!/usr/bin/env bash
# get_tool_info <tool_name> → prints "prop mood side" (space-separated).
# prop is empty string for the default case.

get_tool_info() {
  local tool="$1"
  case "$tool" in
    Edit|Write)                           echo "🔧 focused left"   ;;
    Bash)                                 echo "🪄 focused right"  ;;
    Grep|Glob|ToolSearch)                 echo "🔍 thinking left"  ;;
    Read)                                 echo "📖 thinking left"  ;;
    WebFetch|WebSearch)                   echo "📡 thinking right" ;;
    Agent)                                echo "🤖 excited right"  ;;
    TodoWrite)                            echo "📋 focused left"   ;;
    AskUserQuestion)                      echo "🎤 excited right"  ;;
    CronCreate)                           echo "⏰ focused right"  ;;
    CronDelete)                           echo "🔫 focused left" ;;
    CronList)                             echo "📅 thinking left"  ;;
    EnterPlanMode)                        echo "🗺️ thinking left"  ;;
    ExitPlanMode)                         echo "none excited right" ;;
    EnterWorktree|ExitWorktree)           echo "🌿 focused right"   ;;
    LSP)                                  echo "🔍 thinking left" ;;
    Monitor)                              echo "🔭 thinking left" ;;
    NotebookEdit)                         echo "📓 focused right"   ;;
    PowerShell)                           echo "💠 focused right" ;;
    SendMessage)                          echo "📨 excited right"  ;;
    Skill)                                echo "🍳 excited left" ;;
    TaskCreate)                           echo "📝 focused left"   ;;
    TaskGet|TaskList|TaskUpdate)          echo "📝 thinking left" ;;
    TaskOutput|TaskStop)                  echo "none focused right" ;;
    TeamCreate|TeamDelete)                echo "💰 excited right" ;;
    ListMcpResourcesTool|ReadMcpResourceTool) echo "🔌 thinking left" ;;
    *)                                    echo "none focused none"  ;;
  esac
}
