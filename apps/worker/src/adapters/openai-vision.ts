import OpenAI from "openai";
import { visionAnalysisOutputSchema, type VisionAnalysisOutput } from "@liveearth/domain/schemas";
import type { SceneChannel, WeatherEvidence } from "@liveearth/domain/types";

const outputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["labels", "reason", "breakdown", "confidence", "evidence"],
  properties: {
    labels: { type: "array", maxItems: 8, items: { type: "string" } },
    reason: {
      type: "object",
      additionalProperties: false,
      required: ["en", "zh"],
      properties: {
        en: { type: "string", maxLength: 240 },
        zh: { type: "string", maxLength: 120 },
      },
    },
    breakdown: {
      type: "object",
      additionalProperties: false,
      required: ["visualImpact", "eventIntensity", "motion", "visibility", "technicalQuality", "rarity"],
      properties: Object.fromEntries(
        ["visualImpact", "eventIntensity", "motion", "visibility", "technicalQuality", "rarity"].map(
          (key) => [key, { type: "number", minimum: 0, maximum: 100 }],
        ),
      ),
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", maxItems: 6, items: { type: "string", maxLength: 140 } },
  },
} as const;

export class VisionAnalyzer {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(input: {
    contactSheetDataUrl: string;
    channel: SceneChannel;
    weather: WeatherEvidence;
    location: string;
  }): Promise<VisionAnalysisOutput> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      reasoning: { effort: "none" },
      instructions:
        "You are LiveEarth's evidence-first picture editor. Judge only visible evidence and supplied weather fields. Never infer lightning, danger, rarity, or exact conditions that are not visible or present in weather data. Write one restrained documentary sentence in English and Simplified Chinese. Event intensity means general visible activity for earth, weather drama for storm, wave/tidal activity for ocean, and atmosphere/light transition for night.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Channel: ${input.channel}\nLocation: ${input.location}\nVerified weather: ${JSON.stringify(input.weather)}\nThe image is a chronological 3x2 contact sheet sampled from the current live feed.`,
            },
            { type: "input_image", image_url: input.contactSheetDataUrl, detail: "low" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "liveearth_scene_analysis",
          strict: true,
          schema: outputJsonSchema,
        },
      },
    });

    return visionAnalysisOutputSchema.parse(JSON.parse(response.output_text));
  }
}
