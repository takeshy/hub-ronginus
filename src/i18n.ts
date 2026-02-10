/**
 * Internationalization (i18n) for Ronginus (GemiHub)
 */

export type Locale = "en" | "ja";

export interface Translations {
  debateArena: string;
  debateSubtitle: string;
  debateTheme: string;
  debateThemePlaceholder: string;
  numberOfTurns: string;
  startDebate: string;
  stopDebate: string;
  saveToNote: string;
  newDebate: string;
  theme: string;
  turn: string;
  thinking: string;
  turnComplete: string;
  concluding: string;
  voting: string;
  complete: string;
  error: string;
  ready: string;
  discussion: string;
  conclusions: string;
  votingResults: string;
  winner: string;
  draw: string;
  conclusion: string;
  noWinner: string;
  enterTheme: string;
  needOneParticipant: string;
  debateParticipants: string;
  voteParticipants: string;
  addParticipant: string;
  removeParticipant: string;
  role: string;
  rolePlaceholder: string;
  user: string;
  gemini: string;
  yourTurn: string;
  yourRole: string;
  submitResponse: string;
  selectVote: string;
  voteReason: string;
  submitVote: string;
  type: string;
  yourPosition: string;
  settings: string;
  systemPrompt: string;
  conclusionPrompt: string;
  votePrompt: string;
  save: string;
  cancel: string;
  debateThemeHeader: string;
  previousDiscussion: string;
  yourTask: string;
  yourTaskInstruction: string;
  completeDiscussion: string;
  finalConclusions: string;
  conclusionOf: (name: string) => string;
  voteFormatInstruction: string;
  defaultSystemPrompt: string;
  defaultConclusionPrompt: string;
  defaultVotePrompt: string;
  saving: string;
  saved: string;
  resetToDefault: string;
}

const en: Translations = {
  debateArena: "AI Debate Arena",
  debateSubtitle: "Role-based AI Discussion",
  debateTheme: "Debate Theme",
  debateThemePlaceholder: "Enter a topic for discussion...",
  numberOfTurns: "Number of Turns",
  startDebate: "Start Debate",
  stopDebate: "Stop",
  saveToNote: "Save to Drive",
  newDebate: "New Debate",
  theme: "Theme",
  turn: "Turn",
  thinking: "Thinking...",
  turnComplete: "Turn Complete",
  concluding: "Drawing Conclusions...",
  voting: "Voting...",
  complete: "Complete",
  error: "Error",
  ready: "Ready",
  discussion: "Discussion",
  conclusions: "Conclusions",
  votingResults: "Voting Results",
  winner: "Winner",
  draw: "Draw",
  conclusion: "Conclusion",
  noWinner: "No winner",
  enterTheme: "Please enter a debate theme",
  needOneParticipant: "At least 1 participant is required",
  debateParticipants: "Debate Participants",
  voteParticipants: "Vote Participants",
  addParticipant: "Add",
  removeParticipant: "Remove",
  role: "Role",
  rolePlaceholder: "e.g. Affirmative, Critical...",
  user: "User",
  gemini: "Gemini",
  yourTurn: "Your Turn",
  yourRole: "Your role",
  submitResponse: "Submit",
  selectVote: "Select your vote",
  voteReason: "Reason",
  submitVote: "Submit Vote",
  type: "Type",
  yourPosition: "Your position",
  settings: "Settings",
  systemPrompt: "System Prompt",
  conclusionPrompt: "Conclusion Prompt",
  votePrompt: "Vote Prompt",
  save: "Save",
  cancel: "Cancel",
  debateThemeHeader: "Debate Theme",
  previousDiscussion: "Previous Discussion",
  yourTask: "Your Task",
  yourTaskInstruction: "Consider the perspectives shared above and provide your thoughts. Build upon, challenge, or refine the ideas presented.",
  completeDiscussion: "Complete Discussion",
  finalConclusions: "Final Conclusions",
  conclusionOf: (name) => `${name}'s Conclusion`,
  voteFormatInstruction: "Format: VOTE: [Name] - [Reason]",
  defaultSystemPrompt: "You are discussing a theme with other participants. Share your thoughts concisely.",
  defaultConclusionPrompt: `Based on all the discussion so far, please provide your FINAL CONCLUSION on the theme.
Be clear and decisive. Summarize your position in a well-structured manner.
Start your response with "CONCLUSION:" followed by your final answer.`,
  defaultVotePrompt: `You have seen the conclusions from all participants.
Now you must vote for the BEST conclusion (you can also vote for your own if you believe it's the best).
Consider clarity, logical reasoning, and completeness.`,
  saving: "Saving...",
  saved: "Debate saved to Drive",
  resetToDefault: "Reset",
};

const ja: Translations = {
  debateArena: "AI討論アリーナ",
  debateSubtitle: "ロールベースAI議論",
  debateTheme: "討論テーマ",
  debateThemePlaceholder: "議論するトピックを入力...",
  numberOfTurns: "ターン数",
  startDebate: "討論開始",
  stopDebate: "停止",
  saveToNote: "Driveに保存",
  newDebate: "新規討論",
  theme: "テーマ",
  turn: "ターン",
  thinking: "思考中...",
  turnComplete: "ターン完了",
  concluding: "結論を出しています...",
  voting: "投票中...",
  complete: "完了",
  error: "エラー",
  ready: "準備完了",
  discussion: "議論",
  conclusions: "結論",
  votingResults: "投票結果",
  winner: "勝者",
  draw: "引き分け",
  conclusion: "結論",
  noWinner: "勝者なし",
  enterTheme: "討論テーマを入力してください",
  needOneParticipant: "参加者が1人以上必要です",
  debateParticipants: "討論参加者",
  voteParticipants: "投票参加者",
  addParticipant: "追加",
  removeParticipant: "削除",
  role: "役割",
  rolePlaceholder: "例: 肯定派、批判派...",
  user: "ユーザー",
  gemini: "Gemini",
  yourTurn: "あなたの番です",
  yourRole: "あなたの役割",
  submitResponse: "送信",
  selectVote: "投票先を選択",
  voteReason: "理由",
  submitVote: "投票",
  type: "タイプ",
  yourPosition: "あなたの立場",
  settings: "設定",
  systemPrompt: "システムプロンプト",
  conclusionPrompt: "結論プロンプト",
  votePrompt: "投票プロンプト",
  save: "保存",
  cancel: "キャンセル",
  debateThemeHeader: "討論テーマ",
  previousDiscussion: "これまでの議論",
  yourTask: "あなたの課題",
  yourTaskInstruction: "上記の視点を考慮し、考えを述べてください。アイデアを発展・批判・洗練させてください。",
  completeDiscussion: "議論全体",
  finalConclusions: "最終結論",
  conclusionOf: (name) => `${name}の結論`,
  voteFormatInstruction: "形式：投票: [名前] - [理由]",
  defaultSystemPrompt: "他の参加者とテーマについて議論しています。簡潔に考えを述べてください。",
  defaultConclusionPrompt: `これまでの議論を踏まえて、テーマについての最終結論を述べてください。
明確かつ決定的に。立場を整理された形でまとめてください。
回答は「結論：」から始めてください。`,
  defaultVotePrompt: `全参加者の結論を確認しました。
最も優れた結論に投票してください（自分の結論が最も優れていると思えば投票可能）。
明確さ、論理的推論、完全性を考慮してください。`,
  saving: "保存中...",
  saved: "討論をDriveに保存しました",
  resetToDefault: "初期化",
};

const translations: Record<Locale, Translations> = { en, ja };

export function resolveLocale(locale?: string): Locale {
  if (locale?.startsWith("ja")) return "ja";
  return "en";
}

export function t(locale?: string): Translations {
  return translations[resolveLocale(locale)];
}
