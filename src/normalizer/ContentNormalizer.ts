export interface NormalizationResult {
  raw: string;
  normalized: string;
  // normalizedToRaw[normalizedIndex] = rawIndex
  normalizedToRaw: number[];
}

export class ContentNormalizer {
  /**
   * Normalizes input text safely while preserving original offsets.
   * Handles zero-width characters, unusual whitespace, case normalization.
   */
  public normalize(input: string): NormalizationResult {
    if (!input) {
      return { raw: input, normalized: '', normalizedToRaw: [] };
    }

    let normalized = '';
    const map: number[] = [];
    let i = 0;

    while (i < input.length) {
      const char = input[i];

      // 1. Skip zero-width characters and control marks
      if (/[\u200B-\u200D\uFEFF\u200E-\u200F\u202A-\u202E]/.test(char)) {
        i++;
        continue;
      }

      // 2. Collapse whitespace
      if (/\s/.test(char)) {
        normalized += ' ';
        map.push(i);
        // Skip subsequent whitespace
        while (i + 1 < input.length && /\s/.test(input[i + 1])) {
          i++;
        }
        i++;
        continue;
      }

      // 3. Lowercase normalization
      const lower = char.toLowerCase();
      for (let j = 0; j < lower.length; j++) {
        normalized += lower[j];
        map.push(i);
      }
      
      i++;
    }

    return {
      raw: input,
      normalized,
      normalizedToRaw: map
    };
  }
}
