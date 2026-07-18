declare const __GEMIHUB_DESKTOP__: boolean;

interface DesktopProjectFiles {
  create(path: string, content: string | ArrayBuffer): Promise<void>;
}

interface DesktopPluginAPI {
  projectFiles?: DesktopProjectFiles;
  [key: string]: unknown;
}

export function adaptPluginAPI<T>(input: T): T {
  if (!__GEMIHUB_DESKTOP__) return input;
  const api = input as T & DesktopPluginAPI;
  const files = api.projectFiles;
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
