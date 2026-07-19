/**
 * Ronginus - AI Debate Plugin for GemiHub
 *
 * Multiple AI participants with different roles and models discuss a theme
 * in multiple turns, draw conclusions, and vote for the best.
 */

import { DebatePanel } from "./ui/DebatePanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { adaptPluginAPI } from "./host";

// PluginAPI type (minimal shape expected by the host)
interface PluginAPI {
  registerView(view: {
    id: string;
    name: string;
    icon?: string;
    location: "sidebar" | "main";
    component: unknown;
  }): void;
  registerSettingsTab(tab: {
    component: unknown;
  }): void;
  llm?: {
    listModels?(): Promise<Array<{ id: string; label: string; provider: string; model: string }>>;
    chat(
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string; modelId?: string; systemPrompt?: string }
    ): Promise<string>;
  };
  gemini?: {
    chat(
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string; systemPrompt?: string }
    ): Promise<string>;
  };
  drive: {
    createFile(name: string, content: string): Promise<{ id: string; name: string }>;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
}

class RonginusPlugin {
  onload(hostAPI: PluginAPI): void {
    const api = adaptPluginAPI(hostAPI);
    if (!api.llm && !api.gemini) {
      throw new Error("Ronginus requires an LLM chat API.");
    }
    // Register the debate panel as a sidebar view
    api.registerView({
      id: "ronginus-debate",
      name: "AI Debate",
      location: "sidebar",
      component: DebatePanel,
    });

    // Register settings tab (shown via gear icon in Settings > Plugins)
    api.registerSettingsTab({
      component: SettingsPanel,
    });
  }

  onunload(): void {
    // cleanup handled by host
  }
}

module.exports = RonginusPlugin;
