/**
 * Types for Ronginus - AI Debate Plugin (Gemini Hub)
 */

// Participant types: "gemini" uses the API, "user" provides manual input
export type ParticipantType = "gemini" | "user";

// Debate participant (with role)
export interface Participant {
  id: string;
  type: ParticipantType;
  role: string;           // e.g. "Affirmative", "Critical"
  displayName: string;    // e.g. "Gemini（Affirmative）"
}

// Vote participant
export interface Voter {
  id: string;
  type: ParticipantType;
  displayName: string;
}

export interface DebateTurn {
  turnNumber: number;
  responses: DebateResponse[];
  timestamp: number;
}

export interface DebateResponse {
  participantId: string;
  displayName: string;
  content: string;
  isConclusion: boolean;
  timestamp: number;
  error?: string;
}

export interface DebateConclusion {
  participantId: string;
  displayName: string;
  content: string;
}

export interface VoteResult {
  voterId: string;
  voterDisplayName: string;
  votedForId: string;
  votedForDisplayName: string;
  reason?: string;
}

export interface DebateResult {
  theme: string;
  turns: DebateTurn[];
  conclusions: DebateConclusion[];
  votes: VoteResult[];
  winnerId: string | null;
  winnerIds: string[];
  isDraw: boolean;
  finalConclusion: string;
  startTime: number;
  endTime: number;
  debateParticipants: Participant[];
  voteParticipants: Voter[];
}

// Settings (stored via plugin storage API)
export interface RonginusSettings {
  defaultTurns: number;
  systemPrompt: string;
  conclusionPrompt: string;
  votePrompt: string;
}

// Debate UI state
export type DebatePhase =
  | "idle"
  | "thinking"
  | "turn_complete"
  | "concluding"
  | "voting"
  | "complete"
  | "error";

export interface DebateState {
  phase: DebatePhase;
  currentTurn: number;
  totalTurns: number;
  theme: string;
  turns: DebateTurn[];
  conclusions: DebateConclusion[];
  votes: VoteResult[];
  winnerId: string | null;
  winnerIds: string[];
  isDraw: boolean;
  finalConclusion: string;
  error?: string;
  streamingParticipantId?: string;
  startTime?: number;
  endTime?: number;
  pendingUserInput?: {
    type: "debate" | "vote";
    participantId: string;
    role?: string;
  };
  debateParticipants: Participant[];
  voteParticipants: Voter[];
}
