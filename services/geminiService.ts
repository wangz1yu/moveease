
declare var process: any;

import { GoogleGenAI, Type } from "@google/genai";
import { Exercise, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSmartWorkout = async (focusArea: string, language: Language): Promise<Exercise[]> => {
  try {
    const model = "gemini-2.5-flash";
    const langInstruction = language === 'zh' ? 'in Chinese (Simplified)' : 'in English';
    
    // Updated prompt to force strict category matching
    const prompt = `
      Create a short "Micro-Fitness" workout plan for an office worker focusing SPECIFICALLY on: ${focusArea}.
      Generate 3 simple exercises that can be done in an office chair or standing at a desk.
      Each exercise should take about 30-60 seconds.
      Provide the response exclusively in raw JSON format (no markdown code blocks).
      The content (name, description) must be written ${langInstruction}.
      IMPORTANT: The 'category' field for each exercise MUST be exactly "${focusArea}".
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              duration: { type: Type.NUMBER, description: "Duration in seconds" },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              imageUrl: { type: Type.STRING, description: "Use a placeholder URL like https://picsum.photos/400/300?random=X" }
            },
            required: ["id", "name", "duration", "description", "category"]
          }
        }
      }
    });

    let rawText = response.text || "[]";
    
    // Clean up Markdown code blocks if present (e.g. ```json ... ```)
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const exercises = JSON.parse(rawText);
    
    // Patch images with random IDs to ensure they look different
    return exercises.map((ex: any, index: number) => ({
        ...ex,
        imageUrl: `https://picsum.photos/400/300?random=${Date.now() + index}`
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error; // Re-throw to handle in UI
  }
};
