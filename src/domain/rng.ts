export class SeededRng {
  private state: number;

  public constructor(seed: number = 0x5eed1234) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  public getSeedState(): number {
    return this.state >>> 0;
  }

  public setSeedState(state: number): void {
    this.state = state >>> 0 || 0x9e3779b9;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state = this.state >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(minInclusive: number, maxInclusive: number): number {
    const low = Math.ceil(Math.min(minInclusive, maxInclusive));
    const high = Math.floor(Math.max(minInclusive, maxInclusive));
    if (high <= low) {
      return low;
    }
    return low + Math.floor(this.nextFloat() * (high - low + 1));
  }

  public chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.nextFloat() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const index = this.nextInt(0, items.length - 1);
    const chosen = items[index];
    if (chosen === undefined) {
      throw new Error('Unexpected undefined element during RNG pick');
    }
    return chosen;
  }

  public weightedPick<T>(entries: ReadonlyArray<{ readonly item: T; readonly weight: number }>): T {
    if (entries.length === 0) {
      throw new Error('Cannot pick from empty weighted list');
    }
    let total = 0;
    for (const entry of entries) {
      if (entry.weight > 0) {
        total += entry.weight;
      }
    }
    if (total <= 0) {
      const fallback = entries[0];
      if (!fallback) {
        throw new Error('Empty fallback in weightedPick');
      }
      return fallback.item;
    }
    let roll = this.nextFloat() * total;
    for (const entry of entries) {
      if (entry.weight <= 0) continue;
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.item;
      }
    }
    const last = entries[entries.length - 1];
    if (!last) {
      throw new Error('Unexpected missing last item in weightedPick');
    }
    return last.item;
  }
}
