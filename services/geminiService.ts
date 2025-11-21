
import { GoogleGenAI, Type } from "@google/genai";
import { MissionData, StageType } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateMissionBriefing = async (score: number, stageType: StageType): Promise<MissionData> => {
  const ai = getClient();
  
  // Fallback if no API key or error
  const fallback: MissionData = {
    title: "SECTOR OMEGA DEFENSE",
    description: "Sensors detect incoming hostile fleet. Intercept and destroy all targets. Protect the core at all costs.",
    target: "Unknown Armada"
  };

  if (!ai) return fallback;

  let context = "";
  switch(stageType) {
      case StageType.ASTEROID_FIELD: context = "The sector is filled with dense asteroid fields and space debris. Navigation is critical."; break;
      case StageType.ENEMY_FLEET: context = "Main enemy battle fleet detected. Heavy resistance expected. Dogfight capabilities required."; break;
      case StageType.PLANET_SURFACE: context = "Mission takes place in low orbit over a hostile planet. Beware of ground-based anti-air turrets."; break;
      case StageType.SPACE_FORTRESS: context = "Infiltrating enemy space fortress. Narrow corridors and heavy defenses. Precision flying required."; break;
      default: context = "Deep space interception mission.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a short, intense, sci-fi mission briefing for a space shooter game. 
      The player has achieved a score of ${score}.
      Current Mission Environment: ${context}
      The tone should be urgent and military.
      Return the result in JSON format with 'title', 'description' (max 25 words), and 'target' keys.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            target: { type: Type.STRING }
          },
          required: ["title", "description", "target"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as MissionData;
    }
    return fallback;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return fallback;
  }
};
