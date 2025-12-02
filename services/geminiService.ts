
import { Exercise, Language } from "../types";

// 修改为您的后端地址，如果是本地开发可能是 http://localhost:3000/api
// 如果是线上环境，留空使用相对路径 (Web) 或配置绝对路径 (小程序)
const API_BASE = '/api'; 

export const generateSmartWorkout = async (focusArea: string, language: Language): Promise<Exercise[]> => {
  try {
    // Determine API URL based on environment
    // In a real WeChat Mini Program, this needs to be the full https domain (e.g., https://www.sitclock.com/api/generate-workout)
    const url = `${API_BASE}/generate-workout`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        focusArea,
        language
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate workout');
    }

    const exercises = await response.json();
    return exercises;

  } catch (error) {
    console.error("AI Generation Service Error:", error);
    throw error;
  }
};
