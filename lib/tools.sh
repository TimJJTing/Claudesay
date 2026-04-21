#!/usr/bin/env bash
# get_tool_info <tool_name> → prints "prop mood side" (space-separated).
# Reads TOOL_INFO_* vars from characters/default.sh (sourced before this file
# in pre-tool-use.sh); falls back to hardcoded defaults when vars are unset.

get_tool_info() {
  local tool="$1"
  case "$tool" in
    Edit|Write)                                echo "${TOOL_INFO_EDIT:-🔧 focused left}"        ;;
    Bash)                                      echo "${TOOL_INFO_BASH:-🪄 excited right}"        ;;
    Grep|Glob|ToolSearch)                      echo "${TOOL_INFO_SEARCH:-🔍 focused left}"       ;;
    Read)                                      echo "${TOOL_INFO_READ:-📖 focused left}"         ;;
    WebFetch|WebSearch)                        echo "${TOOL_INFO_WEB:-📡 thinking right}"        ;;
    Agent)                                     echo "${TOOL_INFO_AGENT:-🤖 excited right}"       ;;
    TodoWrite)                                 echo "${TOOL_INFO_TODO:-📋 focused left}"         ;;
    AskUserQuestion)                           echo "${TOOL_INFO_ASK:-🎤 excited right}"         ;;
    CronCreate)                                echo "${TOOL_INFO_CRON_CREATE:-⏰ focused right}" ;;
    CronDelete)                                echo "${TOOL_INFO_CRON_DELETE:-🔫 focused left}"  ;;
    CronList)                                  echo "${TOOL_INFO_CRON_LIST:-📅 thinking left}"   ;;
    EnterPlanMode)                             echo "${TOOL_INFO_PLAN_ENTER:-🗺️ thinking left}"  ;;
    ExitPlanMode)                              echo "${TOOL_INFO_PLAN_EXIT:-none excited right}"  ;;
    EnterWorktree|ExitWorktree)                echo "${TOOL_INFO_WORKTREE:-🌿 focused right}"    ;;
    LSP|Monitor)                               echo "${TOOL_INFO_SEARCH:-🔍 focused left}"       ;;
    NotebookEdit)                              echo "${TOOL_INFO_NOTEBOOK:-📓 focused right}"    ;;
    PowerShell)                                echo "${TOOL_INFO_POWERSHELL:-💠 focused right}"  ;;
    SendMessage)                               echo "${TOOL_INFO_MESSAGE:-📨 excited right}"     ;;
    Skill)                                     echo "${TOOL_INFO_SKILL:-🍳 excited left}"        ;;
    TaskCreate)                                echo "${TOOL_INFO_TASK_WRITE:-📝 focused left}"   ;;
    TaskGet|TaskList|TaskUpdate)               echo "${TOOL_INFO_TASK_READ:-📝 thinking left}"   ;;
    TaskOutput|TaskStop)                       echo "${TOOL_INFO_TASK_STOP:-none focused right}" ;;
    TeamCreate|TeamDelete)                     echo "${TOOL_INFO_TEAM:-💰 excited right}"        ;;
    ListMcpResourcesTool|ReadMcpResourceTool)  echo "${TOOL_INFO_MCP:-🔌 thinking left}"        ;;
    *)                                         echo "${TOOL_INFO_DEFAULT:-none happy none}"      ;;
  esac
}
