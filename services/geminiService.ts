import { GoogleGenerativeAI } from '@google/genai';

let geminiClient: GoogleGenerativeAI | null = null;
let currentKeyIndex = 0;
let availableKeys: string[] = [];

export const initializeGemini = (keys: string[]) => {
  if (keys && keys.length > 0) {
    availableKeys = keys.filter(key => key && key.trim() !== '');
    currentKeyIndex = 0;
    if (availableKeys.length > 0) {
      geminiClient = new GoogleGenerativeAI(availableKeys[currentKeyIndex]);
      console.log(`Gemini initialized with ${availableKeys.length} keys`);
    }
  }
};

const rotateKey = (): boolean => {
  if (availableKeys.length <= 1) {
    console.warn("No other keys available for rotation");
    return false;
  }
  
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;
  console.log(`Rotating to key index: ${currentKeyIndex}`);
  
  geminiClient = new GoogleGenerativeAI(availableKeys[currentKeyIndex]);
  return true;
};

export const generateResponse = async (
  prompt: string, 
  persona: string, 
  imageBase64?: string
): Promise<string> => {
  if (!geminiClient) {
    throw new Error("Gemini not initialized. Please check your API keys.");
  }

  const maxRetries = availableKeys.length || 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const fullPrompt = `${persona}\n\nUser: ${prompt}\n\nAI Response:`;
      
      if (imageBase64) {
        // Remove data URL prefix if present
        const base64Data = imageBase64.includes('base64,') 
          ? imageBase64.split('base64,')[1] 
          : imageBase64;
        
        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        };
        
        const textPart = { text: fullPrompt };
        const result = await model.generateContent([textPart, imagePart]);
        return result.response.text();
      } else {
        const result = await model.generateContent(fullPrompt);
        return result.response.text();
      }
      
    } catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('quota')) {
        console.warn(`Rate limit detected on key ${currentKeyIndex + 1}`);
        
        // Try to rotate key
        if (rotateKey() && attempt < maxRetries - 1) {
          console.log(`Retrying with new key...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          continue;
        }
      }
      
      // For other errors, break immediately
      break;
    }
  }
  
  // If all attempts failed
  throw lastError || new Error("Failed to generate response after all attempts");
};
