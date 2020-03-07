import { ServerConfig } from "./server-config";

export class SettingsReader {
  private settings: ServerConfig | null = null;
  private static instance: SettingsReader | null = null;

  private constructor() {}

  public static getInstance(): SettingsReader {
    if (this.instance === null) {
      this.instance = new SettingsReader();
    }
    return this.instance;
  }

  public getServerSettings(): ServerConfig | null {
    return this.settings;
  }

  public storeServerSettings(settings: ServerConfig): void {
    this.settings = settings;
  }
}
