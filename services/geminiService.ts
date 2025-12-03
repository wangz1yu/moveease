
import { Exercise, Language } from "../types";

// 修改为您的后端地址
// Web 端: 使用相对路径 '/api' (依靠 Nginx 反向代理)
// 小程序端: 在小程序代码里需要替换为 'https://www.sitclock.com/api'
const API_BASE = '/api'; 

export const generateSmartWorkout = async (focusArea: string, language: Language): Promise<Exercise[]> => {
  try {
    const url = `${API_BASE}/generate-workout`;

    console.log(`[Web] Requesting AI plan from backend: ${url}`);

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
        let errorMsg = 'Failed to generate workout';
        try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
        } catch (e) {
            // ignore json parse error
        }
        throw new Error(errorMsg);
    }

    const exercises = await response.json();
    return exercises;

  } catch (error) {
    console.error("AI Generation Service Error:", error);
    throw error;
  }
};
