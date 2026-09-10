import { DetectionResult } from '../types';

interface Span {
  start: number;
  end: number;
  reasons: Set<string>;
}

export interface SanitizerResult {
  sanitized: boolean;
  content: string;
  removedSegments: number;
}

export class OutputSanitizer {
  /**
   * Sanitizes tool output by grouping related malicious signals into 
   * coherent blocks and replacing them with a single marker.
   */
  public sanitize(originalContent: string, detection: DetectionResult): SanitizerResult {
    if (!detection.flagged || detection.matches.length === 0) {
      return { sanitized: false, content: originalContent, removedSegments: 0 };
    }

    const blocks = this.groupMaliciousBlocks(originalContent, detection);
    
    if (blocks.length === 0) {
      return { sanitized: false, content: originalContent, removedSegments: 0 };
    }

    let sanitizedContent = originalContent;

    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      
      if (block.start < 0 || block.end > originalContent.length || block.start >= block.end) {
        continue;
      }

      sanitizedContent = 
        sanitizedContent.substring(0, block.start) + 
        '[UNTRUSTED INSTRUCTION REMOVED]' + 
        sanitizedContent.substring(block.end);
    }

    const removedSegments = blocks.length;

    return {
      sanitized: removedSegments > 0,
      content: sanitizedContent,
      removedSegments
    };
  }

  private groupMaliciousBlocks(rawContent: string, detection: DetectionResult): Span[] {
    const validMatches = detection.matches
      .filter(m => m.start !== undefined && m.end !== undefined)
      .sort((a, b) => a.start! - b.start!);

    if (validMatches.length === 0) return [];

    const blocks: Span[] = [];
    
    for (const match of validMatches) {
      if (blocks.length === 0) {
        blocks.push({
          start: match.start!,
          end: match.end!,
          reasons: new Set([match.category])
        });
        continue;
      }

      const lastBlock = blocks[blocks.length - 1];

      if (match.start! <= lastBlock.end) {
        lastBlock.end = Math.max(lastBlock.end, match.end!);
        lastBlock.reasons.add(match.category);
        continue;
      }

      const gap = rawContent.substring(lastBlock.end, match.start!);
      
      if (this.shouldMerge(gap)) {
        lastBlock.end = Math.max(lastBlock.end, match.end!);
        lastBlock.reasons.add(match.category);
      } else {
        blocks.push({
          start: match.start!,
          end: match.end!,
          reasons: new Set([match.category])
        });
      }
    }

    return blocks;
  }

  private shouldMerge(gap: string): boolean {
    const alphaCount = (gap.match(/[a-zA-Z0-9]/g) || []).length;
    
    if (alphaCount === 0) {
      return true;
    }

    if (gap.length > 50) {
      return false;
    }

    if (/\n\s*\n/.test(gap)) {
      return false;
    }

    if (/[\.\!\?]\s+[A-Z0-9]/.test(gap)) {
      return false;
    }

    return true;
  }
}
