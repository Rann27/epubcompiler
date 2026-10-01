import { create } from "zustand";
import type { MetadataPreset, PresetFields } from "../types/book";

type PresetStore = {
  presets: MetadataPreset[];
  load: () => Promise<void>;
  // "merge" keeps fields the existing preset already has; "replace" swaps them wholesale.
  upsert: (name: string, fields: PresetFields, mode: "merge" | "replace") => Promise<MetadataPreset>;
  remove: (name: string) => Promise<void>;
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const usePresetStore = create<PresetStore>((set, get) => {
  const commit = async (presets: MetadataPreset[]) => {
    set({ presets });
    await window.epubCompiler.storePresets(presets);
  };

  return {
    presets: [],
    load: async () => {
      set({ presets: await window.epubCompiler.loadPresets() });
    },
    upsert: async (name, fields, mode) => {
      const trimmed = name.trim();
      const existing = get().presets.find((preset) => sameName(preset.name, trimmed));
      const saved: MetadataPreset = {
        name: existing?.name ?? trimmed,
        fields: mode === "merge" && existing ? { ...existing.fields, ...fields } : fields
      };
      const others = get().presets.filter((preset) => preset !== existing);
      await commit([...others, saved].sort((a, b) => a.name.localeCompare(b.name)));
      return saved;
    },
    remove: async (name) => {
      await commit(get().presets.filter((preset) => !sameName(preset.name, name)));
    }
  };
});
