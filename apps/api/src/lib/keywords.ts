export class KeywordFilter {
  private readonly filter: Set<string>;
  private readonly partialMatchThreshold = 0.8; // For fuzzy matching

  constructor(keywords: string[]) {
    this.filter = new Set(keywords.map((k) => this.normalizeKeyword(k)));
  }

  private normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().trim();
  }

  public static readonly CODING_KEYWORDS = {
    languages: [
      "python",
      "javascript",
      "typescript",
      "java",
      "c++",
      "ruby",
      "rust",
      "go",
      "swift",
      "kotlin",
      "scala",
      "php",
      "perl",
    ],
    concepts: [
      "code",
      "program",
      "function",
      "debug",
      "algorithm",
      "class",
      "object",
      "method",
      "module",
      "library",
      "framework",
      "api",
      "interface",
      "compile",
      "refactor",
    ],
    dataStructures: [
      "array",
      "list",
      "stack",
      "queue",
      "tree",
      "graph",
      "hash",
      "map",
      "set",
      "heap",
      "recursion",
      "iteration",
    ],
    webDev: [
      "react",
      "vue",
      "angular",
      "node",
      "express",
      "flask",
      "django",
      "backend",
      "frontend",
      "fullstack",
      "api",
    ],
    practices: [
      "testing",
      "optimization",
      "debugging",
      "refactoring",
      "parsing",
      "regex",
      "deployment",
      "security",
    ],
  };

  public static readonly MATH_KEYWORDS = {
    general: [
      "calculate",
      "solve",
      "equation",
      "math",
      "formula",
      "theorem",
      "proof",
      "computation",
    ],
    branches: [
      "algebra",
      "geometry",
      "calculus",
      "statistics",
      "probability",
      "trigonometry",
      "logarithm",
    ],
    concepts: [
      "matrix",
      "vector",
      "derivative",
      "integral",
      "polynomial",
      "numerical",
      "linear",
      "nonlinear",
    ],
    applications: [
      "optimization",
      "regression",
      "interpolation",
      "extrapolation",
      "algorithm",
      "function",
    ],
  };

  public static readonly GENERAL_KEYWORDS = {
    general: [
      "explain",
      "describe",
      "who",
      "what",
      "where",
      "when",
      "why",
      "how",
      "history",
      "science",
      "literature",
      "philosophy",
      "opinion",
      "perspectives",
      "compare",
      "contrast",
      "different views",
    ],
  };

  public static readonly CREATIVE_KEYWORDS = {
    creative: [
      "create",
      "design",
      "write",
      "generate",
      "story",
      "fiction",
      "poem",
      "creative",
      "imagine",
      "brainstorm",
      "original",
      "novel",
      "innovative",
    ],
  };

  public static readonly REASONING_KEYWORDS = {
    reasoning: [
      "analyze",
      "evaluate",
      "critique",
      "assess",
      "judge",
      "compare",
      "debate",
      "argue",
      "pros",
      "cons",
      "advantages",
      "disadvantages",
    ],
  };

  private static flattenKeywords(
    keywordObj: Record<string, string[]>,
  ): string[] {
    return Object.values(keywordObj).flat();
  }

  public static getAllCodingKeywords(): string[] {
    return KeywordFilter.flattenKeywords(KeywordFilter.CODING_KEYWORDS);
  }

  public static getAllMathKeywords(): string[] {
    return KeywordFilter.flattenKeywords(KeywordFilter.MATH_KEYWORDS);
  }

  public static getAllGeneralKeywords(): string[] {
    return KeywordFilter.flattenKeywords(KeywordFilter.GENERAL_KEYWORDS);
  }

  public static getAllCreativeKeywords(): string[] {
    return KeywordFilter.flattenKeywords(KeywordFilter.CREATIVE_KEYWORDS);
  }

  public static getAllReasoningKeywords(): string[] {
    return KeywordFilter.flattenKeywords(KeywordFilter.REASONING_KEYWORDS);
  }

  public hasKeywords(text: string): boolean {
    const words = this.tokenizeText(text);
    return words.some((word) => this.isMatch(word));
  }

  public getMatchedKeywords(text: string): string[] {
    const words = this.tokenizeText(text);
    return words.filter((word) => this.isMatch(word));
  }

  public getCategorizedMatches(text: string): Record<string, string[]> {
    const words = this.tokenizeText(text);
    const matches: Record<string, string[]> = {};

    for (const word of words) {
      const category = this.findKeywordCategory(word);
      if (category) {
        matches[category] = matches[category] || [];
        matches[category].push(word);
      }
    }

    return matches;
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((word) => word.length > 2);
  }

  private isMatch(word: string): boolean {
    const normalized = this.normalizeKeyword(word);

    if (this.filter.has(normalized)) {
      return true;
    }

    return this.hasPartialMatch(normalized);
  }

  private hasPartialMatch(word: string): boolean {
    for (const keyword of this.filter) {
      if (
        this.calculateSimilarity(word, keyword) >= this.partialMatchThreshold
      ) {
        return true;
      }
    }
    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    return (
      (longer.length - this.levenshteinDistance(longer, shorter)) /
      longer.length
    );
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const memo: Record<string, number> = {};
    const key = `${str1}-${str2}`;

    if (memo[key] !== undefined) {
      return memo[key];
    }

    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    memo[key] = matrix[str1.length][str2.length];
    return memo[key];
  }

  private findKeywordCategory(word: string): string | null {
    for (const [category, keywords] of Object.entries(
      KeywordFilter.CODING_KEYWORDS,
    )) {
      if (
        keywords.some(
          (k) =>
            this.calculateSimilarity(word, k) >= this.partialMatchThreshold,
        )
      ) {
        return `coding_${category}`;
      }
    }

    for (const [category, keywords] of Object.entries(
      KeywordFilter.MATH_KEYWORDS,
    )) {
      if (
        keywords.some(
          (k) =>
            this.calculateSimilarity(word, k) >= this.partialMatchThreshold,
        )
      ) {
        return `math_${category}`;
      }
    }

    return null;
  }
}
