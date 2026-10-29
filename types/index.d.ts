export type Mood = 'happy' | 'excited' | 'thinking' | 'focused' | 'upset' | 'error'

export type Side = 'left' | 'right'

// What the character holds for one tool. `prop: null` means empty hands.
export type ToolLook = { prop: string | null; mood: Mood; side: Side | null }

// A tool call that runs now. The band above the prompt shows the newest one.
export type ActiveTool = { id: string; label: string; look: ToolLook }

// A subagent that the main loop spawned, drawn as a small character to the
// right of the main one. `label` is the task under its feet. `look` is the tool
// that its agent runs now, and `toolId` the id of that call. `x` is its column
// in the band now (negative is behind the main character). `phase` is `work`
// while it runs; `done` and `failed` walk it off to the right. A crewmate that
// failed first stands still for `hold` ticks.
export type Crewmate = {
  id: string
  label: string
  look: ToolLook | null
  toolId: string | null
  x: number
  phase: 'work' | 'done' | 'failed'
  hold: number
}

// What the character says about the last reply: the <claudesay> tag at its end.
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
      // True while a main-loop turn runs, so a tag that is not complete yet is hidden.
      streaming: boolean
      // The keys (tagKey) of the tags at the end of final answers, and of the tags
      // that an interrupt or an error cut. Kept in the store too.
      finals: string[]
      character: CharacterOverride | null
      crew: Crewmate[]
    }
  }
}
