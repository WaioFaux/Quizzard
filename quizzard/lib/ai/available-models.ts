/**
 * Available Free Models for OpenRouter
 * This configuration is client-safe and doesn't depend on server environment variables
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
}

export const AVAILABLE_FREE_MODELS: OpenRouterModel[] = [
  {
    id: "inclusionai/ling-3.0-flash-vl:free",
    name: "Ling 3.0 Flash VL",
    description: "Fast, capable with vision support. Good all-rounder for text and image tasks.",
    contextLength: 262144,
  },
  {
    id: "nex-agi/nex-n2.5-mini:free",
    name: "Nex-N2.5-Mini",
    description: "Lightweight agentic model. Good for coding and text tasks.",
    contextLength: 262144,
  },
  {
    id: "nex-agi/nex-n2.5-pro:free",
    name: "Nex-N2.5-Pro",
    description: "Higher quality agentic model. Better reasoning and analysis.",
    contextLength: 262144,
  },
];

export const DEFAULT_MODEL = "inclusionai/ling-3.0-flash-vl:free";
