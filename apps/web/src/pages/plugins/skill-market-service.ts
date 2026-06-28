const marketBaseUrl = "https://ai.dingd.cn";
const cacheKey = "skill_market_cache";
const cacheDurationMs = 60 * 60 * 1000;

export interface SkillMarketInstallUrl {
  type: "zip" | "git";
  url: string;
}

export interface MarketSkill {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  labels?: string[];
  installUrls?: SkillMarketInstallUrl[];
  detailUrl?: string;
  version?: string;
}

interface SkillMarketCache {
  data: MarketSkill[];
  timestamp: number;
}

export interface SkillMarketService {
  fetchMarketSkills(useCache?: boolean): Promise<MarketSkill[]>;
}

export const skillMarketService: SkillMarketService = {
  async fetchMarketSkills(useCache = true): Promise<MarketSkill[]> {
    if (useCache) {
      const cached = getCachedMarketSkills();
      if (cached) return cached;
    }

    const response = await fetch(`${marketBaseUrl}/api/market/skills`);
    if (!response.ok) {
      throw new Error(`加载推荐技能失败: HTTP ${response.status}`);
    }
    const data = await response.json();
    const skills = Array.isArray(data) ? data.filter(isMarketSkill) : [];
    setCachedMarketSkills(skills);
    return skills;
  },
};

function getCachedMarketSkills(): MarketSkill[] | null {
  try {
    const rawCache = localStorage.getItem(cacheKey);
    if (!rawCache) return null;
    const parsed = JSON.parse(rawCache) as SkillMarketCache;
    if (!Array.isArray(parsed.data) || Date.now() - parsed.timestamp > cacheDurationMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.data.filter(isMarketSkill);
  } catch {
    return null;
  }
}

function setCachedMarketSkills(data: MarketSkill[]) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Cache failures should not block the market list.
  }
}

function isMarketSkill(value: unknown): value is MarketSkill {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}
