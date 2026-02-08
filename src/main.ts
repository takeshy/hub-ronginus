/**
 * Ronginus - AI Debate Plugin for Gemini Hub
 *
 * Multiple Gemini participants with different roles discuss a theme
 * in multiple turns, draw conclusions, and vote for the best.
 */

import { DebatePanel } from "./ui/DebatePanel";
import { SettingsPanel } from "./ui/SettingsPanel";

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
  gemini: {
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
  onload(api: PluginAPI): void {
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
