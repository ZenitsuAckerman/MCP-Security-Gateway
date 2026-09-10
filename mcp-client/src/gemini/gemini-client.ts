import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiConfig } from './gemini-config.js';

export class GeminiClient {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    const config = getGeminiConfig();
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model;
  }

  get client() {
    return this.ai;
  }

  getModelName() {
    return this.model;
  }
}
