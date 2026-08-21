// ORBITAL BOWL types — plain data shared by the framework-free simulation and HUD.
export type GamePhase = "aim" | "flight" | "result" | "complete";

export interface GameSettings {
  angle: number;
  velocity: number;
  gravity: number;
}

export interface GameHudState extends GameSettings {
  phase: GamePhase;
  throwNumber: number;
  pinsStanding: number;
  pinsFelledThisThrow: number;
  score: number;
  bestScore: number;
  soundEnabled: boolean;
  status: string;
  launchReady: boolean;
}

export interface GameCallbacks {
  onHudChange: (state: GameHudState) => void;
}

export interface StoredProgress {
  highScore: number;
  bestStrikeStreak: number;
  soundEnabled: boolean;
}
