declare const __GEMIHUB_DESKTOP__: boolean;

import type { LLMModelOption } from "./types";

interface DesktopWorkspaceFiles {
  create(path: string, content: string | ArrayBuffer): Promise<void>;
}

interface DesktopPluginAPI {
  workspaceFiles?: DesktopWorkspaceFiles;
  [key: string]: unknown;
}

interface StoredDesktopModelProfile {
  id?: string;
  name?: string;
  provider?: string;
  enabled?: boolean;
  enabledModels?: string[];
}

interface StoredDesktopChatSettings {
  provider?: string;
  model?: string;
  selectedModelProfileId?: string;
  modelProfiles?: StoredDesktopModelProfile[];
  cliType?: string;
}

/**
 * Compatibility fallback for Desktop versions that predate llm.listModels().
 * Only models from the active profile are returned because the legacy chat API
 * can override a model name but cannot switch provider credentials safely.
 */
export function desktopActiveModelOptions(): LLMModelOption[] {
  if (!__GEMIHUB_DESKTOP__ || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("gemihub-desktop:chat-settings") ||
      localStorage.getItem("llm-hub:chat-settings");
    if (!raw) return [];
    const settings = JSON.parse(raw) as StoredDesktopChatSettings;
    const profile = (settings.modelProfiles || []).find((item) =>
      item.enabled !== false && item.id === settings.selectedModelProfileId
    );
    if (profile) {
      const models = [...new Set((profile.enabledModels || []).filter(Boolean))];
      if (models.length > 0) {
        return models.map((model) => ({
          id: `legacy:${profile.id || "active"}:${model}`,
          label: `${profile.name || profile.provider || "AI"} — ${model}`,
          provider: profile.provider || settings.provider || "",
          model,
        }));
      }
    }
    const model = settings.provider === "cli"
      ? settings.cliType || ""
      : settings.model || "";
    return model ? [{
      id: `legacy:active:${model}`,
      label: `${settings.provider || "AI"} — ${model}`,
      provider: settings.provider || "",
      model,
    }] : [];
  } catch {
    return [];
  }
}

export function isDesktopHost(): boolean {
  return __GEMIHUB_DESKTOP__;
}

export function adaptPluginAPI<T>(input: T): T {
  if (!__GEMIHUB_DESKTOP__) return input;
  const api = input as T & DesktopPluginAPI;
  const files = api.workspaceFiles;
  if (!files) throw new Error("Ronginus requires GemiHub Desktop 0.8.1 or newer.");
  return Object.assign(api, {
    drive: {
      async createFile(name: string, content: string | ArrayBuffer) {
        await files.create(name, content);
        return { id: name, name };
      },
    },
  });
}
