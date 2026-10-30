export type Mood = 'happy' | 'excited' | 'thinking' | 'focused' | 'upset' | 'error'

export type Side = 'left' | 'right'

// What the character holds for one tool. `prop: null` means empty hands.
export type ToolLook = { prop: string | null; mood: Mood; side: Side | null }

// A tool call that runs now. The pane shows the newest one.
export type ActiveTool = { id: string; label: string; look: ToolLook }

// A character on its way down to its slot, the main one or a crewmate: `x` is
// its column in its row of the pane, `y` how many rows over its slot it is now,
// and `plane` the column of the left end of the plane that brings it, or null.
export type Drop = { x: number; y: number; plane: number | null }

// A subagent that the main loop spawned, drawn as a small character in the
// slots after the main one, where it floats down as a Drop (an `x` below 0 is
// out of sight). `label` is the task under its feet. `look` is the tool that
// its agent runs now, and `toolId` the id of that call. `phase` is `work` while
// it runs; `done` and `failed` send it off as a spark, and `spark` counts the
// ticks of the spark. A crewmate that failed first stands still for `hold` ticks.
export type Crewmate = Drop & {
  id: string
  label: string
  look: ToolLook | null
  toolId: string | null
  spark: number
  phase: 'work' | 'done' | 'failed'
  hold: number
}

// What the character says: a mood and the line that the small model wrote
// about the last reply (parseSaid), or the greeting.
export type Saying = { mood: Mood; line: string }

// The shape of ~/.claude/claudesay/character.json. Every field is optional:
// a field that is not there keeps the default value.
export type CharacterOverride = {
  sideWidth?: number
  centerWidth?: number
  cellHeight?: number
  topHeight?: number
  faces?: Partial<Record<Mood, string | string[]>>
  cells?: Partial<Record<CellName, string[]>>
  propLeft?: string[]
  propRight?: string[]
  tools?: Record<string, Partial<ToolLook>>
}

export type CellName =
  | 'topLeft'
  | 'top'
  | 'topRight'
  | 'left'
  | 'body'
  | 'right'
  | 'bottomLeft'
  | 'bottom'
  | 'bottomRight'

declare module 'claude-code' {
  interface PluginState {
    claudesay: {
      running: ActiveTool[]
      saying: Saying | null
      // True while a main-loop turn runs, and until the line about its answer comes.
      working: boolean
      character: CharacterOverride | null
      crew: Crewmate[]
      // The drop of the main character, while it floats down into a pane that just opened.
      landing: Drop | null
    }
  }
}
