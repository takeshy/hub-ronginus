/**
 * Debate Engine for Ronginus (GemiHub)
 * Uses the host LLM chat API, with an optional model per participant.
 */

import type {
  DebateTurn,
  DebateResponse,
  DebateConclusion,
  VoteResult,
  DebateResult,
  DebatePhase,
  Participant,
  Voter,
  RonginusSettings,
} from "../types";
import { t } from "../i18n";

// Minimal PluginAPI shape needed by the engine
interface LLMAPI {
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; modelId?: string; systemPrompt?: string }
  ): Promise<string>;
}

export interface UserInputRequest {
  type: "debate" | "vote";
  participantId: string;
  displayName: string;
  role?: string;
  candidates?: { id: string; displayName: string }[];
}

export interface UserInputResponse {
  content: string;
  votedForId?: string;
  reason?: string;
}

export interface DebateCallbacks {
  onPhaseChange?: (phase: DebatePhase) => void;
  onTurnStart?: (turnNumber: number) => void;
  onResponseStart?: (participantId: string) => void;
  onResponseComplete?: (participantId: string, response: DebateResponse) => void;
  onTurnComplete?: (turn: DebateTurn) => void;
  onConclusionComplete?: (conclusion: DebateConclusion) => void;
  onVoteComplete?: (vote: VoteResult) => void;
  onDebateComplete?: (result: DebateResult) => void;
  onError?: (error: Error) => void;
  onUserInputRequest?: (request: UserInputRequest) => Promise<UserInputResponse>;
}

export class DebateEngine {
  private llm: LLMAPI;
  private settings: RonginusSettings;
  private language?: string;
  private callbacks: DebateCallbacks = {};
  private aborted = false;

  constructor(llm: LLMAPI, settings: RonginusSettings, language?: string) {
    this.llm = llm;
    this.settings = settings;
    this.language = language;
  }

  setCallbacks(callbacks: DebateCallbacks): void {
    this.callbacks = callbacks;
  }

  stop(): void {
    this.aborted = true;
  }

  private async chat(
    messages: Array<{ role: string; content: string }>,
    options: { model?: string; modelId?: string; systemPrompt?: string }
  ): Promise<string> {
    const content = await this.llm.chat(messages, options);
    if (!content?.trim()) throw new Error(t(this.language).emptyModelResponse);
    return content;
  }

  async runDebate(
    theme: string,
    turns: number,
    debateParticipants: Participant[],
    voteParticipants: Voter[]
  ): Promise<DebateResult> {
    this.aborted = false;
    const startTime = Date.now();
    const allTurns: DebateTurn[] = [];
    const conclusions: DebateConclusion[] = [];
    const votes: VoteResult[] = [];

    try {
      // Discussion turns
      for (let turn = 1; turn <= turns; turn++) {
        if (this.aborted) throw new Error("Debate aborted");
        this.callbacks.onPhaseChange?.("thinking");
        this.callbacks.onTurnStart?.(turn);

        const isLastTurn = turn === turns;
        const turnResult = await this.runTurn(theme, turn, allTurns, debateParticipants, isLastTurn);
        allTurns.push(turnResult);
        this.callbacks.onTurnComplete?.(turnResult);
        this.callbacks.onPhaseChange?.("turn_complete");
      }

      // Conclusion phase
      this.callbacks.onPhaseChange?.("concluding");
      const lastTurn = allTurns[allTurns.length - 1];
      for (const response of lastTurn.responses) {
        if (response.isConclusion) {
          const conclusion: DebateConclusion = {
            participantId: response.participantId,
            displayName: response.displayName,
            content: response.content,
          };
          conclusions.push(conclusion);
          this.callbacks.onConclusionComplete?.(conclusion);
        }
      }

      // If no conclusions from last turn, get explicit ones
      if (conclusions.length === 0) {
        const explicit = await this.getConclusions(theme, allTurns, debateParticipants);
        conclusions.push(...explicit);
      }

      // Voting phase
      this.callbacks.onPhaseChange?.("voting");
      const voteResults = await this.runVoting(theme, conclusions, voteParticipants);
      votes.push(...voteResults);

      // Determine winner
      const { winnerIds, isDraw } = this.determineWinners(votes, conclusions);
      const winnerId = isDraw ? null : winnerIds[0] || null;

      let finalConclusion = "";
      if (isDraw) {
        finalConclusion = winnerIds
          .map((id) => conclusions.find((c) => c.participantId === id)?.content || "")
          .join("\n\n---\n\n");
      } else if (winnerId) {
        finalConclusion = conclusions.find((c) => c.participantId === winnerId)?.content || "";
      }

      const result: DebateResult = {
        theme,
        turns: allTurns,
        conclusions,
        votes,
        winnerId,
        winnerIds,
        isDraw,
        finalConclusion,
        startTime,
        endTime: Date.now(),
        debateParticipants,
        voteParticipants,
      };

      this.callbacks.onPhaseChange?.("complete");
      this.callbacks.onDebateComplete?.(result);
      return result;
    } catch (error) {
      this.callbacks.onPhaseChange?.("error");
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  // ---- Turn execution ----

  private async runTurn(
    theme: string,
    turnNumber: number,
    previousTurns: DebateTurn[],
    participants: Participant[],
    isLastTurn: boolean
  ): Promise<DebateTurn> {
    const responses: DebateResponse[] = [];
    const baseContext = this.buildTurnContext(theme, previousTurns, isLastTurn);

    // Run participants sequentially (each sees previous responses in context)
    for (const participant of participants) {
      if (this.aborted) throw new Error("Debate aborted");

      this.callbacks.onResponseStart?.(participant.id);

      if (participant.type === "user") {
        const response = await this.getUserDebateInput(participant);
        if (response) {
          response.isConclusion = isLastTurn;
          responses.push(response);
          this.callbacks.onResponseComplete?.(participant.id, response);
        }
        continue;
      }

      // AI participant
      let context = baseContext;
      if (participant.role) {
        context += `\n\n${t(this.language).yourPosition}: ${participant.role}`;
      }

      let systemPrompt = this.settings.systemPrompt;
      if (participant.role) {
        systemPrompt += `\n\n${t(this.language).yourPosition}: ${participant.role}`;
      }

      try {
        const content = await this.chat(
          [{ role: "user", content: context }],
          {
            model: participant.model || undefined,
            modelId: participant.modelId || undefined,
            systemPrompt,
          }
        );

        const debateResponse: DebateResponse = {
          participantId: participant.id,
          displayName: participant.displayName,
          content,
          isConclusion: isLastTurn,
          timestamp: Date.now(),
        };
        responses.push(debateResponse);
        this.callbacks.onResponseComplete?.(participant.id, debateResponse);
      } catch (error) {
        const errResponse: DebateResponse = {
          participantId: participant.id,
          displayName: participant.displayName,
          content: "",
          isConclusion: false,
          timestamp: Date.now(),
          error: (error as Error).message,
        };
        responses.push(errResponse);
        this.callbacks.onResponseComplete?.(participant.id, errResponse);
      }
    }

    if (responses.length === 0 || responses.every((response) => response.error)) {
      const details = responses.map((response) => response.error).filter(Boolean).join("; ");
      throw new Error(
        `${t(this.language).allParticipantResponsesFailed}${details ? ` ${details}` : ""}`
      );
    }

    return { turnNumber, responses, timestamp: Date.now() };
  }

  private buildTurnContext(theme: string, previousTurns: DebateTurn[], isLastTurn: boolean): string {
    const i18n = t(this.language);
    let context = `# ${i18n.debateThemeHeader}\n${theme}\n\n`;

    if (previousTurns.length > 0) {
      context += `# ${i18n.previousDiscussion}\n\n`;
      for (const turn of previousTurns) {
        context += `## ${i18n.turn} ${turn.turnNumber}\n\n`;
        for (const response of turn.responses) {
          context += `### ${response.displayName}\n${response.content}\n\n`;
        }
      }
      context += `# ${i18n.yourTask}\n${i18n.yourTaskInstruction}\n\n`;
    }

    if (isLastTurn) {
      context += `\n${this.settings.conclusionPrompt}\n`;
    }

    return context;
  }

  // ---- Conclusions ----

  private async getConclusions(
    theme: string,
    turns: DebateTurn[],
    participants: Participant[]
  ): Promise<DebateConclusion[]> {
    const conclusions: DebateConclusion[] = [];
    const baseContext = this.buildConclusionContext(theme, turns);

    for (const participant of participants) {
      if (this.aborted) throw new Error("Debate aborted");

      if (participant.type === "user") {
        const response = await this.getUserDebateInput(participant);
        if (response) {
          conclusions.push({
            participantId: participant.id,
            displayName: participant.displayName,
            content: response.content,
          });
          this.callbacks.onConclusionComplete?.(conclusions[conclusions.length - 1]);
        }
        continue;
      }

      let context = baseContext;
      if (participant.role) {
        context += `\n\n${t(this.language).yourPosition}: ${participant.role}`;
      }

      let systemPrompt = this.settings.systemPrompt;
      if (participant.role) {
        systemPrompt += `\n\n${t(this.language).yourPosition}: ${participant.role}`;
      }

      try {
        const content = await this.chat(
          [{ role: "user", content: context }],
          {
            model: participant.model || undefined,
            modelId: participant.modelId || undefined,
            systemPrompt,
          }
        );
        const conclusion: DebateConclusion = {
          participantId: participant.id,
          displayName: participant.displayName,
          content,
        };
        conclusions.push(conclusion);
        this.callbacks.onConclusionComplete?.(conclusion);
      } catch (error) {
        conclusions.push({
          participantId: participant.id,
          displayName: participant.displayName,
          content: `Error: ${(error as Error).message}`,
        });
      }
    }

    return conclusions;
  }

  private buildConclusionContext(theme: string, turns: DebateTurn[]): string {
    const i18n = t(this.language);
    let context = `# ${i18n.debateThemeHeader}\n${theme}\n\n`;
    context += `# ${i18n.completeDiscussion}\n\n`;

    for (const turn of turns) {
      context += `## ${i18n.turn} ${turn.turnNumber}\n\n`;
      for (const response of turn.responses) {
        context += `### ${response.displayName}\n${response.content}\n\n`;
      }
    }

    context += `\n${this.settings.conclusionPrompt}\n`;
    return context;
  }

  // ---- Voting ----

  private async runVoting(
    theme: string,
    conclusions: DebateConclusion[],
    voters: Voter[]
  ): Promise<VoteResult[]> {
    const votes: VoteResult[] = [];
    let successfulVotes = 0;
    const context = this.buildVotingContext(theme, conclusions);

    for (const voter of voters) {
      if (this.aborted) throw new Error("Debate aborted");

      if (voter.type === "user") {
        if (this.callbacks.onUserInputRequest) {
          const candidates = conclusions.map((c) => ({
            id: c.participantId,
            displayName: c.displayName,
          }));
          const response = await this.callbacks.onUserInputRequest({
            type: "vote",
            participantId: voter.id,
            displayName: voter.displayName,
            candidates,
          });
          const votedFor = conclusions.find((c) => c.participantId === response.votedForId);
          const vote: VoteResult = {
            voterId: voter.id,
            voterDisplayName: voter.displayName,
            votedForId: response.votedForId || conclusions[0]?.participantId || "",
            votedForDisplayName: votedFor?.displayName || "",
            reason: response.reason,
          };
          votes.push(vote);
          successfulVotes += 1;
          this.callbacks.onVoteComplete?.(vote);
        }
        continue;
      }

      try {
        const content = await this.chat(
          [{ role: "user", content: context }],
          {
            model: voter.model || undefined,
            modelId: voter.modelId || undefined,
            systemPrompt: this.settings.systemPrompt,
          }
        );
        const vote = this.parseVote(voter, content, conclusions);
        votes.push(vote);
        successfulVotes += 1;
        this.callbacks.onVoteComplete?.(vote);
      } catch (error) {
        votes.push({
          voterId: voter.id,
          voterDisplayName: voter.displayName,
          votedForId: voter.id,
          votedForDisplayName: voter.displayName,
          reason: `Error: ${(error as Error).message}`,
        });
      }
    }

    if (voters.length > 0 && successfulVotes === 0) {
      throw new Error(t(this.language).allVotesFailed);
    }

    return votes;
  }

  private buildVotingContext(theme: string, conclusions: DebateConclusion[]): string {
    const i18n = t(this.language);
    let context = `# ${i18n.debateThemeHeader}\n${theme}\n\n`;
    context += `# ${i18n.finalConclusions}\n\n`;

    for (const conclusion of conclusions) {
      context += `## ${i18n.conclusionOf(conclusion.displayName)}\n${conclusion.content}\n\n`;
    }

    const participantNames = conclusions.map((c) => c.displayName).join(", ");
    context += `\n${this.settings.votePrompt}\nParticipants: ${participantNames}\n\n${i18n.voteFormatInstruction}\n`;
    return context;
  }

  private parseVote(voter: Voter, response: string, conclusions: DebateConclusion[]): VoteResult {
    const extractReason = (): string | undefined => {
      const patterns = [
        /理由[：:は]\s*([\s\S]+)/i,
        /[Rr]eason[：:]\s*([\s\S]+)/i,
        /[-–—]\s*([\s\S]+)/,
      ];
      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match && match[1].trim()) return match[1].trim();
      }
      const lines = response.split("\n").filter((l) => l.trim());
      if (lines.length > 1) return lines.slice(1).join("\n").trim();
      return undefined;
    };

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Strategy 1: VOTE: Name format
    for (const c of conclusions) {
      const baseName = c.displayName.replace(/[（(].+[）)]/, "").trim();
      const patterns = [
        new RegExp(`(?:VOTE|投票)[：:]\\s*${escapeRegex(c.displayName)}`, "i"),
        new RegExp(`(?:VOTE|投票)[：:]\\s*${escapeRegex(baseName)}`, "i"),
      ];
      for (const p of patterns) {
        if (p.test(response)) {
          return {
            voterId: voter.id,
            voterDisplayName: voter.displayName,
            votedForId: c.participantId,
            votedForDisplayName: c.displayName,
            reason: extractReason(),
          };
        }
      }
    }

    // Strategy 2: Name anywhere
    const sorted = [...conclusions].sort((a, b) => b.displayName.length - a.displayName.length);
    const lower = response.toLowerCase();
    for (const c of sorted) {
      const baseName = c.displayName.replace(/[（(].+[）)]/, "").trim();
      if (lower.includes(c.displayName.toLowerCase()) || lower.includes(baseName.toLowerCase())) {
        return {
          voterId: voter.id,
          voterDisplayName: voter.displayName,
          votedForId: c.participantId,
          votedForDisplayName: c.displayName,
          reason: extractReason(),
        };
      }
    }

    return {
      voterId: voter.id,
      voterDisplayName: voter.displayName,
      votedForId: voter.id,
      votedForDisplayName: voter.displayName,
      reason: "Unable to parse vote",
    };
  }

  // ---- Helpers ----

  private async getUserDebateInput(participant: Participant): Promise<DebateResponse | null> {
    if (!this.callbacks.onUserInputRequest) return null;
    const response = await this.callbacks.onUserInputRequest({
      type: "debate",
      participantId: participant.id,
      displayName: participant.displayName,
      role: participant.role,
    });
    return {
      participantId: participant.id,
      displayName: participant.displayName,
      content: response.content,
      isConclusion: false,
      timestamp: Date.now(),
    };
  }

  private determineWinners(
    votes: VoteResult[],
    conclusions: DebateConclusion[]
  ): { winnerIds: string[]; isDraw: boolean } {
    const counts = new Map<string, number>();
    for (const c of conclusions) counts.set(c.participantId, 0);
    for (const v of votes) counts.set(v.votedForId, (counts.get(v.votedForId) || 0) + 1);

    let max = 0;
    for (const c of counts.values()) if (c > max) max = c;

    const winnerIds: string[] = [];
    for (const [id, c] of counts) if (c === max) winnerIds.push(id);

    return { winnerIds, isDraw: winnerIds.length > 1 };
  }

  // ---- Markdown export ----

  static generateMarkdown(result: DebateResult): string {
    const lines: string[] = [];
    const getName = (id: string) =>
      result.debateParticipants.find((p) => p.id === id)?.displayName || id;

    lines.push(`# AI Debate: ${result.theme}`);
    lines.push("");
    lines.push(`**Date:** ${new Date(result.startTime).toLocaleString()}`);
    lines.push(`**Duration:** ${Math.round((result.endTime - result.startTime) / 1000)}s`);
    if (result.isDraw) {
      lines.push(`**Result:** Draw (${result.winnerIds.map(getName).join(" & ")})`);
    } else {
      lines.push(`**Winner:** ${result.winnerId ? getName(result.winnerId) : "No winner"}`);
    }
    lines.push("");

    lines.push("## Participants");
    lines.push("");
    for (const p of result.debateParticipants) {
      lines.push(`- ${p.displayName}${p.role ? ` (${p.role})` : ""}`);
    }
    lines.push("");

    // Show discussion turns (skip last if it's the conclusion turn)
    const turnsToShow = result.conclusions.length > 0
      ? result.turns.filter((t) => t.turnNumber !== result.turns.length)
      : result.turns;

    if (turnsToShow.length > 0) {
      lines.push("## Discussion");
      lines.push("");
      for (const turn of turnsToShow) {
        lines.push(`### Turn ${turn.turnNumber}`);
        lines.push("");
        for (const r of turn.responses) {
          lines.push(`#### ${r.displayName}`);
          lines.push("");
          lines.push(r.error ? `> Error: ${r.error}` : r.content);
          lines.push("");
        }
      }
    }

    lines.push("## Conclusions");
    lines.push("");
    for (const c of result.conclusions) {
      lines.push(`### ${c.displayName}`);
      lines.push("");
      lines.push(c.content);
      lines.push("");
    }

    lines.push("## Voting Results");
    lines.push("");
    for (const v of result.votes) {
      lines.push(`- **${v.voterDisplayName}** → **${v.votedForDisplayName}**${v.reason ? `: ${v.reason}` : ""}`);
    }
    lines.push("");

    lines.push("## Final Conclusion");
    lines.push("");
    if (result.isDraw) {
      lines.push(`> **Draw:** ${result.winnerIds.map(getName).join(" & ")}`);
    } else if (result.winnerId) {
      lines.push(`> Winner: **${getName(result.winnerId)}**`);
    }
    lines.push("");
    lines.push(result.finalConclusion);

    return lines.join("\n");
  }
}
