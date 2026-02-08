import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { RonginusSettings } from "../types";
import { t } from "../i18n";

interface SettingsPanelProps {
  api: any;
  language?: string;
  onClose?: () => void;
}

const DEFAULT_SETTINGS: RonginusSettings = {
  defaultTurns: 2,
  systemPrompt: "",
  conclusionPrompt: "",
  votePrompt: "",
};

export function SettingsPanel({ api, language, onClose }: SettingsPanelProps): React.ReactElement {
  const i18n = useMemo(() => t(language), [language]);

  const [settings, setSettings] = useState<RonginusSettings>(() => ({
    ...DEFAULT_SETTINGS,
    systemPrompt: i18n.defaultSystemPrompt,
    conclusionPrompt: i18n.defaultConclusionPrompt,
    votePrompt: i18n.defaultVotePrompt,
  }));
  const [draft, setDraft] = useState<RonginusSettings>(settings);

  useEffect(() => {
    const load = async () => {
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
          defaultTurns: defaultTurns ? parseInt(defaultTurns as string, 10) : 2,
        };

        setSettings(loaded);
        setDraft(loaded);
      } catch {
        // Use defaults on error
      }
    };
    load();
  }, [api.storage]);

  const handleSave = useCallback(async () => {
    try {
      await Promise.all([
        api.storage.set("systemPrompt", draft.systemPrompt),
        api.storage.set("conclusionPrompt", draft.conclusionPrompt),
        api.storage.set("votePrompt", draft.votePrompt),
        api.storage.set("defaultTurns", String(draft.defaultTurns)),
      ]);
      setSettings(draft);
      onClose?.();
    } catch {
      // silently fail
    }
  }, [api.storage, draft, onClose]);

  const handleCancel = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="space-y-4">
      <div>
        <div className="ronginus-settings-label-row">
          <label className={labelClass}>{i18n.systemPrompt}</label>
          <button
            className="ronginus-reset-default-button"
            onClick={() => setDraft((prev) => ({ ...prev, systemPrompt: i18n.defaultSystemPrompt }))}
          >
            {i18n.resetToDefault}
          </button>
        </div>
        <textarea
          className={inputClass}
          value={draft.systemPrompt}
          onChange={(e) => setDraft((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          rows={4}
        />
      </div>
      <div>
        <div className="ronginus-settings-label-row">
          <label className={labelClass}>{i18n.conclusionPrompt}</label>
          <button
            className="ronginus-reset-default-button"
            onClick={() => setDraft((prev) => ({ ...prev, conclusionPrompt: i18n.defaultConclusionPrompt }))}
          >
            {i18n.resetToDefault}
          </button>
        </div>
        <textarea
          className={inputClass}
          value={draft.conclusionPrompt}
          onChange={(e) => setDraft((prev) => ({ ...prev, conclusionPrompt: e.target.value }))}
          rows={4}
        />
      </div>
      <div>
        <div className="ronginus-settings-label-row">
          <label className={labelClass}>{i18n.votePrompt}</label>
          <button
            className="ronginus-reset-default-button"
            onClick={() => setDraft((prev) => ({ ...prev, votePrompt: i18n.defaultVotePrompt }))}
          >
            {i18n.resetToDefault}
          </button>
        </div>
        <textarea
          className={inputClass}
          value={draft.votePrompt}
          onChange={(e) => setDraft((prev) => ({ ...prev, votePrompt: e.target.value }))}
          rows={4}
        />
      </div>
      <div>
        <label className={labelClass}>{i18n.numberOfTurns}</label>
        <input
          type="number"
          className={inputClass + " max-w-[100px]"}
          min={1}
          max={10}
          value={draft.defaultTurns}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              defaultTurns: Math.max(1, Math.min(10, parseInt(e.target.value) || 2)),
            }))
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          {i18n.save}
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
        >
          {i18n.cancel}
        </button>
      </div>
    </div>
  );
}
