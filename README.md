# Ronginus - AI Debate Plugin for GemiHub

Ronginus is a shared [GemiHub](https://github.com/takeshy/gemihub) and GemiHub Desktop plugin that enables structured debates between multiple AI participants with different roles and models. Participants discuss a given theme across turns, draw conclusions, and vote for the best one.

## Features

- **Multi-model Debates**: On GemiHub Desktop, choose a configured OpenAI-compatible, Gemini, Vertex AI, Anthropic, or local-agent model for each participant.
- **Role-based Discussion**: Assign roles (e.g. "Affirmative", "Critical") to each participant. The same model can participate multiple times with different perspectives.
- **User Participation**: Join the debate yourself alongside AI participants.
- **Turn-based Discussion**: Configurable number of turns (1-10). Each participant sees all previous responses before responding.
- **Conclusion & Voting**: After discussion turns, each participant provides a final conclusion, then all participants vote for the best one.
- **Transcript Export**: Save the complete debate transcript to Google Drive on Web or the active Workspace on Desktop.
- **Persistent Settings**: System/conclusion/vote prompts are saved per-plugin via the storage API.
- **i18n**: English and Japanese (auto-detected from browser locale).

## Installation

### Via GemiHub Settings or GemiHub Desktop 0.8.1+

1. Open GemiHub Settings > Plugins tab
2. Enter `takeshy/hub-ronginus` and click Install
3. Enable the plugin

Both hosts use the same GitHub Release. GemiHub loads `main.js`; GemiHub Desktop applies the repository-owned `patches/gemihub-desktop.patch` and saves transcripts in the active Workspace.

### Building from Source

```bash
git clone https://github.com/takeshy/hub-ronginus
cd hub-ronginus
npm install
npm run build
```

This produces `main.js`, `styles.css`, `manifest.json`, and `patches/gemihub-desktop.patch` for a GitHub Release.

## Screenshots

| Setup | Discussion | Voting | Result |
|:---:|:---:|:---:|:---:|
| ![Setup](debate_prepare.png) | ![Discussion](debate_start.png) | ![Voting](voting.png) | ![Result](result.png) |

## Usage

1. After installation, the **AI Debate** panel appears in the right sidebar.
2. Enter a debate theme/topic.
3. Set the number of turns.
4. **Add participants** — choose AI or User and optionally set an AI model and a role. Desktop lists configured models; leaving the model blank uses the host's current model.
5. Click **Start Debate**.
6. AI participants generate responses sequentially. If you added yourself as User, you'll be prompted for input.
7. On the final turn, each participant provides a conclusion.
8. All participants vote for the best conclusion.
9. Winner (or draw) is announced.
10. Click **Save to Drive** on Web or **Save to Workspace** on Desktop to export the transcript.

## Settings

Expand the **Settings** section on the debate panel to customize:

| Setting | Description |
|---------|-------------|
| System Prompt | Base instructions given to all AI participants |
| Conclusion Prompt | Prompt appended on the final turn for conclusions |
| Vote Prompt | Prompt for the voting phase (vote format instruction is auto-appended) |

## Plugin API Usage

This plugin uses the following GemiHub Plugin APIs:

- `api.registerView()` — registers the debate panel as a sidebar view
- `api.llm.listModels()` (Desktop) — lists providers and models configured in the host
- `api.llm.chat()` (Desktop) / `api.gemini.chat()` (Web) — sends messages to the participant's selected model with role-specific system prompts
- `api.drive.createFile()` — saves debate transcripts to Google Drive
- `api.storage.get/set()` — persists plugin settings

## How It Works

```
Theme Input + Participant Selection
    |
    v
+------------------------------------+
|  Turn 1                            |
|  AI(Model A, Role A) -> AI(Model B, Role B) |
|  -> User(Role C) -> ...            |
+------------------------------------+
    | (each sees previous responses)
    v
+------------------------------------+
|  Turn 2 ~ N-1                      |
|  Refined thoughts based on         |
|  previous discussion               |
+------------------------------------+
    | (final turn = conclusion)
    v
+------------------------------------+
|  Final Turn                        |
|  Each participant provides a       |
|  final conclusion                  |
+------------------------------------+
    |
    v
+------------------------------------+
|  Voting Phase                      |
|  All participants vote for the     |
|  best conclusion                   |
+------------------------------------+
    |
    v
Winner Announced (or Draw if tied)
```

## License

MIT License
