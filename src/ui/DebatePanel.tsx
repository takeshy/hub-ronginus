import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  DebateState,
  DebatePhase,
  DebateTurn,
  DebateResponse,
  DebateConclusion,
  DebateResult,
  VoteResult,
  Participant,
  Voter,
  ParticipantType,
  RonginusSettings,
} from "../types";
import { DebateEngine, UserInputRequest, UserInputResponse } from "../core/debateEngine";
import { t, Translations } from "../i18n";

interface DebatePanelProps {
  api: any;
  language?: string;
}

// Helper to get base display name for a participant type
function getBaseDisplayName(type: ParticipantType, i18n: Translations): string {
  switch (type) {
    case "gemini":
      return "Gemini";
    case "user":
      return i18n.user;
    default:
      return type;
  }
}

function getPhaseLabel(phase: DebatePhase, i18n: Translations): string {
  switch (phase) {
    case "thinking":
      return i18n.thinking;
    case "turn_complete":
      return i18n.turnComplete;
    case "concluding":
      return i18n.concluding;
    case "voting":
      return i18n.voting;
    case "complete":
      return i18n.complete;
    case "error":
      return i18n.error;
    default:
      return i18n.ready;
  }
}

const DEFAULT_SETTINGS: RonginusSettings = {
  defaultTurns: 2,
  systemPrompt: "",
  conclusionPrompt: "",
  votePrompt: "",
};

export function DebatePanel({ api, language }: DebatePanelProps): React.ReactElement {
  const i18n = useMemo(() => t(language), [language]);

  // Settings state (read-only, loaded from storage)
  const [settings, setSettings] = useState<RonginusSettings>(() => ({
    ...DEFAULT_SETTINGS,
    systemPrompt: i18n.defaultSystemPrompt,
    conclusionPrompt: i18n.defaultConclusionPrompt,
    votePrompt: i18n.defaultVotePrompt,
  }));

  // Setup form state
  const [theme, setTheme] = useState("");
  const [turns, setTurns] = useState(2);
  const [debateParticipants, setDebateParticipants] = useState<Participant[]>([]);
  const [voteParticipants, setVoteParticipants] = useState<Voter[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newType, setNewType] = useState<ParticipantType>("gemini");
  const [newRole, setNewRole] = useState("");
  const [showAddVoterDialog, setShowAddVoterDialog] = useState(false);
  const [newVoterType, setNewVoterType] = useState<ParticipantType>("gemini");

  // Debate state
  const [debateState, setDebateState] = useState<DebateState>({
    phase: "idle",
    currentTurn: 0,
    totalTurns: 2,
    theme: "",
    turns: [],
    conclusions: [],
    votes: [],
    winnerId: null,
    winnerIds: [],
    isDraw: false,
    finalConclusion: "",
    debateParticipants: [],
    voteParticipants: [],
  });

  // User input state
  const [userInput, setUserInput] = useState("");
  const [userVoteTarget, setUserVoteTarget] = useState("");
  const [userVoteReason, setUserVoteReason] = useState("");

  // Turn expand state
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({});

  // Save notification
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Engine and resolver refs
  const engineRef = useRef<DebateEngine | null>(null);
  const userInputResolverRef = useRef<((response: UserInputResponse) => void) | null>(null);
  const debateResultRef = useRef<DebateResult | null>(null);

  // Load settings from api.storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [systemPrompt, conclusionPrompt, votePrompt, defaultTurns] = await Promise.all([
          api.storage.get("systemPrompt"),
          api.storage.get("conclusionPrompt"),
          api.storage.get("votePrompt"),
          api.storage.get("defaultTurns"),
        ]);

        const loaded: RonginusSettings = {
          systemPrompt: systemPrompt || i18n.defaultSystemPrompt,
          conclusionPrompt: conclusionPrompt || i18n.defaultConclusionPrompt,
          votePrompt: votePrompt || i18n.defaultVotePrompt,
          defaultTurns: defaultTurns ? parseInt(defaultTurns, 10) : 2,
        };

        setSettings(loaded);
        setTurns(loaded.defaultTurns);
      } catch {
        // Use defaults on error
      }
    };
    loadSettings();
  }, [api.storage]);

  // Add debate participant (also adds a corresponding voter)
  const handleAddParticipant = useCallback(() => {
    const existingCount = debateParticipants.filter((p) => p.type === newType).length;
    const baseDisplayName = getBaseDisplayName(newType, i18n);
    const displayName = newRole
      ? `${baseDisplayName}\uFF08${newRole}\uFF09`
      : baseDisplayName;

    const newParticipant: Participant = {
      id: `${newType}-${existingCount + 1}-${Date.now()}`,
      type: newType,
      role: newRole || "",
      displayName,
    };

    setDebateParticipants((prev) => [...prev, newParticipant]);
    setVoteParticipants((prev) => [
      ...prev,
      { id: `${newParticipant.type}-voter-${newParticipant.id}`, type: newParticipant.type, displayName },
    ]);
    setNewRole("");
    setShowAddDialog(false);
  }, [debateParticipants, newType, newRole, i18n]);

  // Remove debate participant (also removes corresponding voter)
  const handleRemoveParticipant = useCallback((id: string) => {
    setDebateParticipants((prev) => prev.filter((p) => p.id !== id));
    const voterId = debateParticipants.find((p) => p.id === id)
      ? `${debateParticipants.find((p) => p.id === id)!.type}-voter-${id}`
      : "";
    if (voterId) {
      setVoteParticipants((prev) => prev.filter((v) => v.id !== voterId));
    }
  }, [debateParticipants]);

  // Update participant role (also updates corresponding voter displayName)
  const handleUpdateRole = useCallback((id: string, role: string) => {
    setDebateParticipants((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const baseDisplayName = getBaseDisplayName(p.type, i18n);
          const displayName = role
            ? `${baseDisplayName}\uFF08${role}\uFF09`
            : baseDisplayName;
          return { ...p, role, displayName };
        }
        return p;
      })
    );
    const participant = debateParticipants.find((p) => p.id === id);
    if (participant) {
      const voterId = `${participant.type}-voter-${id}`;
      const baseDisplayName = getBaseDisplayName(participant.type, i18n);
      const displayName = role
        ? `${baseDisplayName}\uFF08${role}\uFF09`
        : baseDisplayName;
      setVoteParticipants((prev) =>
        prev.map((v) => (v.id === voterId ? { ...v, displayName } : v))
      );
    }
  }, [debateParticipants, i18n]);

  // Add vote participant independently
  const handleAddVoter = useCallback(() => {
    const baseDisplayName = getBaseDisplayName(newVoterType, i18n);
    const existingCount = voteParticipants.filter((v) => v.type === newVoterType).length;
    const newVoter: Voter = {
      id: `${newVoterType}-voter-extra-${existingCount + 1}-${Date.now()}`,
      type: newVoterType,
      displayName: baseDisplayName,
    };
    setVoteParticipants((prev) => [...prev, newVoter]);
    setShowAddVoterDialog(false);
  }, [newVoterType, voteParticipants, i18n]);

  // Remove vote participant
  const handleRemoveVoter = useCallback((id: string) => {
    setVoteParticipants((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // Start debate
  const handleStartDebate = useCallback(async () => {
    if (!theme.trim() || debateParticipants.length < 1) return;

    const engine = new DebateEngine(api.gemini, settings, language);
    engineRef.current = engine;
    debateResultRef.current = null;

    setDebateState({
      phase: "thinking",
      currentTurn: 1,
      totalTurns: turns,
      theme,
      turns: [],
      conclusions: [],
      votes: [],
      winnerId: null,
      winnerIds: [],
      isDraw: false,
      finalConclusion: "",
      debateParticipants,
      voteParticipants,
    });
    setExpandedTurns({});

    engine.setCallbacks({
      onPhaseChange: (phase: DebatePhase) => {
        setDebateState((prev) => ({ ...prev, phase }));
      },
      onTurnStart: (turnNumber: number) => {
        setDebateState((prev) => ({ ...prev, currentTurn: turnNumber }));
      },
      onResponseStart: (_participantId: string) => {
        setDebateState((prev) => ({
          ...prev,
          streamingParticipantId: _participantId,
        }));
      },
      onResponseComplete: (_participantId: string, _response: DebateResponse) => {
        setDebateState((prev) => ({
          ...prev,
          streamingParticipantId: undefined,
        }));
      },
      onTurnComplete: (turn: DebateTurn) => {
        setDebateState((prev) => ({
          ...prev,
          turns: [...prev.turns, turn],
        }));
        setExpandedTurns((prev) => ({ ...prev, [turn.turnNumber]: true }));
      },
      onConclusionComplete: (conclusion: DebateConclusion) => {
        setDebateState((prev) => ({
          ...prev,
          conclusions: [...prev.conclusions, conclusion],
        }));
      },
      onVoteComplete: (vote: VoteResult) => {
        setDebateState((prev) => ({
          ...prev,
          votes: [...prev.votes, vote],
        }));
      },
      onDebateComplete: (result: DebateResult) => {
        debateResultRef.current = result;
        setDebateState((prev) => ({
          ...prev,
          phase: "complete",
          winnerId: result.winnerId,
          winnerIds: result.winnerIds,
          isDraw: result.isDraw,
          finalConclusion: result.finalConclusion,
          startTime: result.startTime,
          endTime: result.endTime,
        }));
      },
      onError: (error: Error) => {
        setDebateState((prev) => ({
          ...prev,
          phase: "error",
          error: error.message,
        }));
      },
      onUserInputRequest: async (request: UserInputRequest): Promise<UserInputResponse> => {
        return new Promise<UserInputResponse>((resolve) => {
          userInputResolverRef.current = resolve;
          setDebateState((prev) => ({
            ...prev,
            pendingUserInput: {
              type: request.type,
              participantId: request.participantId,
              role: request.role,
            },
          }));
        });
      },
    });

    try {
      await engine.runDebate(theme, turns, debateParticipants, voteParticipants);
    } catch (error) {
      if (error instanceof Error && error.message === "Debate aborted") {
        return;
      }
      console.error("Debate failed:", error);
    }
  }, [theme, turns, debateParticipants, voteParticipants, settings, api.gemini, language]);

  // Stop debate
  const handleStopDebate = useCallback(() => {
    engineRef.current?.stop();
    userInputResolverRef.current = null;
    setDebateState((prev) => ({
      ...prev,
      phase: "idle",
      pendingUserInput: undefined,
    }));
  }, []);

  // Submit user debate input
  const handleSubmitUserDebate = useCallback(() => {
    if (userInput.trim() && userInputResolverRef.current) {
      userInputResolverRef.current({ content: userInput });
      userInputResolverRef.current = null;
      setUserInput("");
      setDebateState((prev) => ({
        ...prev,
        pendingUserInput: undefined,
      }));
    }
  }, [userInput]);

  // Submit user vote input
  const handleSubmitUserVote = useCallback(() => {
    if (userVoteTarget && userInputResolverRef.current) {
      userInputResolverRef.current({
        content: "",
        votedForId: userVoteTarget,
        reason: userVoteReason,
      });
      userInputResolverRef.current = null;
      setUserVoteTarget("");
      setUserVoteReason("");
      setDebateState((prev) => ({
        ...prev,
        pendingUserInput: undefined,
      }));
    }
  }, [userVoteTarget, userVoteReason]);

  // Save to Drive
  const handleSaveToDrive = useCallback(async () => {
    if (!debateResultRef.current || isSaving) return;

    setIsSaving(true);
    try {
      const markdown = DebateEngine.generateMarkdown(debateResultRef.current);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const sanitizedTheme = debateState.theme.slice(0, 50).replace(/[\\/:*?"<>|]/g, "_");
      const fileName = `${timestamp}-${sanitizedTheme}.md`;

      await api.drive.createFile(fileName, markdown);
      setSaveNotice(i18n.saved);
      setTimeout(() => setSaveNotice(""), 3000);
    } catch (error) {
      console.error("Failed to save debate:", error);
    } finally {
      setIsSaving(false);
    }
  }, [debateState.theme, api.drive, i18n.saved, isSaving]);

  // Reset debate
  const handleReset = useCallback(() => {
    engineRef.current?.stop();
    userInputResolverRef.current = null;
    debateResultRef.current = null;
    setDebateState({
      phase: "idle",
      currentTurn: 0,
      totalTurns: turns,
      theme: "",
      turns: [],
      conclusions: [],
      votes: [],
      winnerId: null,
      winnerIds: [],
      isDraw: false,
      finalConclusion: "",
      debateParticipants: [],
      voteParticipants: [],
    });
    setTheme("");
    setUserInput("");
    setUserVoteTarget("");
    setUserVoteReason("");
    setExpandedTurns({});
    setSaveNotice("");
  }, [turns]);

  // Toggle turn expansion
  const toggleTurn = useCallback((turnNumber: number) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [turnNumber]: !prev[turnNumber],
    }));
  }, []);

  const isRunning =
    debateState.phase !== "idle" &&
    debateState.phase !== "complete" &&
    debateState.phase !== "error";
  const hasActiveDebate = debateState.phase !== "idle";
  const isPendingUserDebate = debateState.pendingUserInput?.type === "debate";
  const isPendingUserVote = debateState.pendingUserInput?.type === "vote";

  return (
    <div className="ronginus-debate-container">
    <div className="ronginus-panel">
      {/* Header */}
      <div className="ronginus-header">
        <h2>{i18n.debateArena}</h2>
        <p className="ronginus-subtitle">{i18n.debateSubtitle}</p>
        {hasActiveDebate && debateState.theme && (
          <div className="ronginus-header-theme">
            <strong>{i18n.theme}:</strong> {debateState.theme}
          </div>
        )}
      </div>

      {/* Idle: Setup Form */}
      {debateState.phase === "idle" && (
        <div className="ronginus-input-section">
          {/* Theme input */}
          <div className="ronginus-input-group">
            <label htmlFor="ronginus-theme-input">{i18n.debateTheme}</label>
            <textarea
              id="ronginus-theme-input"
              className="ronginus-theme-input"
              placeholder={i18n.debateThemePlaceholder}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={3}
            />
          </div>

          {/* Number of turns */}
          <div className="ronginus-input-group">
            <label htmlFor="ronginus-turns-input">{i18n.numberOfTurns}</label>
            <input
              id="ronginus-turns-input"
              type="number"
              className="ronginus-turns-input"
              min={1}
              max={10}
              value={turns}
              onChange={(e) => setTurns(Math.max(1, Math.min(10, parseInt(e.target.value) || 2)))}
            />
          </div>

          {/* Debate Participants Section */}
          <div className="ronginus-participants-section">
            <div className="ronginus-section-header">
              <label>{i18n.debateParticipants}</label>
              <button
                className="ronginus-add-button"
                onClick={() => setShowAddDialog(!showAddDialog)}
              >
                + {i18n.addParticipant}
              </button>
            </div>

            {showAddDialog && (
              <div className="ronginus-add-dialog">
                <div className="ronginus-input-group">
                  <label>{i18n.type}</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ParticipantType)}
                  >
                    <option value="gemini">{getBaseDisplayName("gemini", i18n)}</option>
                    <option value="user">{getBaseDisplayName("user", i18n)}</option>
                  </select>
                </div>
                <div className="ronginus-input-group">
                  <label>{i18n.role}</label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder={i18n.rolePlaceholder}
                  />
                </div>
                <div className="ronginus-dialog-buttons">
                  <button onClick={() => setShowAddDialog(false)}>{i18n.cancel}</button>
                  <button className="mod-cta" onClick={handleAddParticipant}>
                    {i18n.addParticipant}
                  </button>
                </div>
              </div>
            )}

            <div className="ronginus-participants-list">
              {debateParticipants.map((participant) => (
                <div key={participant.id} className="ronginus-participant-item">
                  <span className={`ronginus-cli-badge ${participant.type}`}>
                    {getBaseDisplayName(participant.type, i18n)}
                  </span>
                  <input
                    type="text"
                    className="ronginus-role-input"
                    value={participant.role || ""}
                    onChange={(e) => handleUpdateRole(participant.id, e.target.value)}
                    placeholder={i18n.rolePlaceholder}
                  />
                  <button
                    className="ronginus-remove-button"
                    onClick={() => handleRemoveParticipant(participant.id)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {debateParticipants.length === 0 && (
                <p className="ronginus-empty-list">{i18n.needOneParticipant}</p>
              )}
            </div>
          </div>

          {/* Vote Participants Section */}
          <div className="ronginus-participants-section">
            <div className="ronginus-section-header">
              <label>{i18n.voteParticipants}</label>
              <button
                className="ronginus-add-button"
                onClick={() => setShowAddVoterDialog(!showAddVoterDialog)}
              >
                + {i18n.addParticipant}
              </button>
            </div>

            {showAddVoterDialog && (
              <div className="ronginus-add-dialog">
                <div className="ronginus-input-group">
                  <label>{i18n.type}</label>
                  <select
                    value={newVoterType}
                    onChange={(e) => setNewVoterType(e.target.value as ParticipantType)}
                  >
                    <option value="gemini">{getBaseDisplayName("gemini", i18n)}</option>
                    <option value="user">{getBaseDisplayName("user", i18n)}</option>
                  </select>
                </div>
                <div className="ronginus-dialog-buttons">
                  <button onClick={() => setShowAddVoterDialog(false)}>{i18n.cancel}</button>
                  <button className="mod-cta" onClick={handleAddVoter}>
                    {i18n.addParticipant}
                  </button>
                </div>
              </div>
            )}

            <div className="ronginus-participants-list">
              {voteParticipants.map((voter) => (
                <div key={voter.id} className="ronginus-participant-item">
                  <span className={`ronginus-cli-badge ${voter.type}`}>
                    {voter.displayName}
                  </span>
                  <button
                    className="ronginus-remove-button"
                    onClick={() => handleRemoveVoter(voter.id)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {voteParticipants.length === 0 && (
                <p className="ronginus-empty-list">{i18n.needOneParticipant}</p>
              )}
            </div>
          </div>

          {/* Start button */}
          <button
            className="ronginus-start-button mod-cta"
            onClick={handleStartDebate}
            disabled={!theme.trim() || debateParticipants.length < 1}
          >
            {i18n.startDebate}
          </button>
          {debateParticipants.length < 1 && (
            <p className="ronginus-warning">{i18n.needOneParticipant}</p>
          )}
        </div>
      )}

      {/* User Debate Input */}
      {isPendingUserDebate && debateState.pendingUserInput && (
        <div className="ronginus-user-input-section">
          <h3>{i18n.yourTurn}</h3>
          {debateState.pendingUserInput.role && (
            <p className="ronginus-user-role">
              <strong>{i18n.yourRole}:</strong> {debateState.pendingUserInput.role}
            </p>
          )}
          <textarea
            className="ronginus-user-input"
            placeholder={i18n.debateThemePlaceholder}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={5}
          />
          <button
            className="ronginus-submit-button mod-cta"
            onClick={handleSubmitUserDebate}
            disabled={!userInput.trim()}
          >
            {i18n.submitResponse}
          </button>
        </div>
      )}

      {/* User Vote Input */}
      {isPendingUserVote && debateState.conclusions.length > 0 && (
        <div className="ronginus-user-vote-section">
          <h3>{i18n.selectVote}</h3>
          <div className="ronginus-input-group">
            <label>{i18n.selectVote}</label>
            <select
              className="ronginus-vote-select"
              value={userVoteTarget}
              onChange={(e) => setUserVoteTarget(e.target.value)}
            >
              <option value="">{i18n.selectVote}</option>
              {debateState.conclusions.map((conclusion) => (
                <option key={conclusion.participantId} value={conclusion.participantId}>
                  {conclusion.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="ronginus-input-group">
            <label>{i18n.voteReason}</label>
            <input
              type="text"
              className="ronginus-vote-reason-input"
              value={userVoteReason}
              onChange={(e) => setUserVoteReason(e.target.value)}
              placeholder={i18n.voteReason}
            />
          </div>
          <button
            className="ronginus-submit-button mod-cta"
            onClick={handleSubmitUserVote}
            disabled={!userVoteTarget}
          >
            {i18n.submitVote}
          </button>
        </div>
      )}

      {/* Running: Progress indicator */}
      {isRunning && !isPendingUserDebate && !isPendingUserVote && (
        <div className="ronginus-progress-section">
          <div className="ronginus-status">
            <span className="ronginus-phase">{getPhaseLabel(debateState.phase, i18n)}</span>
            <span className="ronginus-turn-info">
              {i18n.turn} {debateState.currentTurn} / {debateState.totalTurns}
            </span>
          </div>
          {debateState.streamingParticipantId && (
            <div className="ronginus-thinking-indicator">
              <span className="ronginus-waiting">{i18n.thinking}</span>
            </div>
          )}
          <button className="ronginus-stop-button" onClick={handleStopDebate}>
            {i18n.stopDebate}
          </button>
        </div>
      )}

      {/* Completed turns */}
      {debateState.turns.length > 0 && (
        <div>
          <h3>{i18n.discussion}</h3>
          {debateState.turns
            .filter(
              (turn) =>
                !(debateState.conclusions.length > 0 && turn.turnNumber === debateState.totalTurns)
            )
            .map((turn) => (
              <div key={turn.turnNumber} className="ronginus-turn">
                <div
                  className="ronginus-turn-header"
                  onClick={() => toggleTurn(turn.turnNumber)}
                >
                  <span className="ronginus-turn-number">
                    {i18n.turn} {turn.turnNumber}
                  </span>
                  <span className="ronginus-expand-icon">
                    {expandedTurns[turn.turnNumber] ? "\u25BC" : "\u25B6"}
                  </span>
                </div>
                {expandedTurns[turn.turnNumber] && (
                  <div className="ronginus-response-grid">
                    {turn.responses.map((response) => {
                      const participant = debateState.debateParticipants.find(
                        (p) => p.id === response.participantId
                      );
                      return (
                        <div
                          key={response.participantId}
                          className={`ronginus-response-card ${participant?.type || ""}`}
                        >
                          <div className="ronginus-response-header">
                            <span className={`ronginus-cli-badge ${participant?.type || ""}`}>
                              {response.displayName}
                            </span>
                          </div>
                          <div className="ronginus-response-content">
                            {response.error ? (
                              <span className="ronginus-error-message">{response.error}</span>
                            ) : (
                              response.content
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Conclusions */}
      {debateState.conclusions.length > 0 && (
        <div className="ronginus-conclusions-section">
          <h3>{i18n.conclusions}</h3>
          <div className="ronginus-response-grid">
            {debateState.conclusions.map((conclusion) => {
              const participant = debateState.debateParticipants.find(
                (p) => p.id === conclusion.participantId
              );
              return (
                <div
                  key={conclusion.participantId}
                  className={`ronginus-response-card ${participant?.type || ""} conclusion`}
                >
                  <div className="ronginus-response-header">
                    <span className={`ronginus-cli-badge ${participant?.type || ""}`}>
                      {conclusion.displayName}
                    </span>
                    <span className="ronginus-conclusion-badge">{i18n.conclusion}</span>
                  </div>
                  <div className="ronginus-response-content">{conclusion.content}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voting results */}
      {debateState.votes.length > 0 && (
        <div className="ronginus-votes-section">
          <h3>{i18n.votingResults}</h3>
          <div className="ronginus-votes-list">
            {debateState.votes.map((vote, index) => (
              <div key={index} className="ronginus-vote-item">
                <span className="ronginus-cli-badge small">{vote.voterDisplayName}</span>
                <span className="ronginus-vote-arrow">&rarr;</span>
                <span className="ronginus-cli-badge small">{vote.votedForDisplayName}</span>
                {vote.reason && (
                  <span className="ronginus-vote-reason">{vote.reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winner announcement - Draw */}
      {debateState.phase === "complete" && debateState.isDraw && debateState.winnerIds.length > 0 && (
        <div className="ronginus-winner-section">
          <h3>{i18n.draw}</h3>
          <div className="ronginus-draw-cards">
            {debateState.winnerIds.map((winnerId) => {
              const conclusion = debateState.conclusions.find(
                (c) => c.participantId === winnerId
              );
              const participant = debateState.debateParticipants.find(
                (p) => p.id === winnerId
              );
              return (
                <div
                  key={winnerId}
                  className={`ronginus-winner-card ${participant?.type || ""}`}
                >
                  <span className={`ronginus-cli-badge ${participant?.type || ""} large`}>
                    {conclusion?.displayName || winnerId}
                  </span>
                  <div className="ronginus-final-conclusion">
                    {conclusion?.content || ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Winner announcement - Single winner */}
      {debateState.phase === "complete" &&
        !debateState.isDraw &&
        debateState.winnerId && (
          <div className="ronginus-winner-section">
            <h3>{i18n.winner}</h3>
            {(() => {
              const winner = debateState.conclusions.find(
                (c) => c.participantId === debateState.winnerId
              );
              const participant = debateState.debateParticipants.find(
                (p) => p.id === debateState.winnerId
              );
              return (
                <div className={`ronginus-winner-card ${participant?.type || ""}`}>
                  <span className={`ronginus-cli-badge ${participant?.type || ""} large`}>
                    {winner?.displayName || debateState.winnerId}
                  </span>
                  <div className="ronginus-final-conclusion">
                    {debateState.finalConclusion}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      {/* Error display */}
      {debateState.phase === "error" && debateState.error && (
        <div className="ronginus-error-section">
          <h3>{i18n.error}</h3>
          <p className="ronginus-error-message">{debateState.error}</p>
        </div>
      )}

      {/* Save notice */}
      {saveNotice && (
        <p style={{ textAlign: "center", color: "var(--rg-accent)" }}>{saveNotice}</p>
      )}

      {/* Action buttons */}
      {(debateState.phase === "complete" || debateState.phase === "error") && (
        <div className="ronginus-actions-section">
          {debateState.phase === "complete" && (
            <button className="ronginus-save-button mod-cta" onClick={handleSaveToDrive} disabled={isSaving}>
              {isSaving ? i18n.saving : i18n.saveToNote}
            </button>
          )}
          <button className="ronginus-reset-button" onClick={handleReset}>
            {i18n.newDebate}
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
