import { GoogleGenAI, Type } from "@google/genai";
import { Exercise, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSmartWorkout = async (focusArea: string, language: Language): Promise<Exercise[]> => {
  try {
    const model = "gemini-2.5-flash";
    const langInstruction = language === 'zh' ? 'in Chinese (Simplified)' : 'in English';
    
    const prompt = `
      Create a short "Micro-Fitness" workout plan for an office worker focusing on: ${focusArea}.
      Generate 3 simple exercises that can be done in an office chair or standing at a desk.
      Each exercise should take about 30-60 seconds.
      Provide the response exclusively in JSON format.
      The content (name, description) must be written ${langInstruction}.
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
            required: ["id", "name", "duration", "description"]
          }
        }
      }
    });

    const exercises = JSON.parse(response.text || "[]");
    
    // Patch images with random IDs to ensure they look different
    return exercises.map((ex: any, index: number) => ({
        ...ex,
        imageUrl: `https://picsum.photos/400/300?random=${Date.now() + index}`
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    const isZh = language === 'zh';
    return [
      {
        id: 'fallback-1',
        name: isZh ? '深呼吸' : 'Deep Breathing',
        duration: 60,
        category: 'fullbody',
        description: isZh ? '深吸气4秒，屏息4秒，然后呼气4秒。' : 'Inhale deeply for 4 seconds, hold for 4, exhale for 4.',
        imageUrl: 'https://picsum.photos/400/300?random=99'
      }
    ];
  }
};