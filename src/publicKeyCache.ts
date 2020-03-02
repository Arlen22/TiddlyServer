export class PublicKeyCache {
  private cache: { [k: string]: string[] } | null = null;
  private static instance: PublicKeyCache | null = null;

  private constructor() {}

  public static getCache(): PublicKeyCache {
    if (this.instance === null) {
      this.instance = new PublicKeyCache();
    }
    return this.instance;
  }

  public getVal(key: string): string[] | null {
    if (!this.cache) return null;
    return this.cache[key];
  }

  public setVal(key: string, val: string[]): void {
    if (this.cache) {
      this.cache[key] = val;
    } else {
      this.cache = {};
      this.cache[key] = val;
    }
  }

  public keyExists(key: string): boolean {
    return !!(this.cache && this.cache[key]);
  }
}
