
import { GoogleGenerativeAI } from '@google/genai';

let geminiClient: GoogleGenerativeAI | null = null;
let currentKeyIndex = 0;
let availableKeys: string[] = [];
let lastUsedTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 detik antara request

export const initializeGemini = (keys: string[]) => {
  if (keys && keys.length > 0) {
    availableKeys = keys.filter(key => key && key.trim() !== '');
    currentKeyIndex = 0;
    if (availableKeys.length > 0) {
      geminiClient = new GoogleGenerativeAI(availableKeys[currentKeyIndex]);
      console.log(`✅ Gemini initialized with ${availableKeys.length} keys`);
    } else {
      console.warn("⚠️ No valid Gemini keys provided");
    }
  }
};

const rotateKey = (): boolean => {
  if (availableKeys.length <= 1) {
    console.warn("⚠️ No other keys available for rotation");
    return false;
  }
  
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;
  console.log(`🔄 Rotating to key ${currentKeyIndex + 1}/${availableKeys.length}`);
  
  geminiClient = new GoogleGenerativeAI(availableKeys[currentKeyIndex]);
  return true;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateResponse = async (
  prompt: string, 
  persona: string, 
  imageBase64?: string
): Promise<string> => {
  // Cek apakah ada kunci yang tersedia
  if (!geminiClient || availableKeys.length === 0) {
    throw new Error("Gemini API keys not configured. Please add keys in Admin panel.");
  }

  const maxRetries = Math.min(availableKeys.length * 2, 5); // Maksimal 5 retry
  let lastError: Error | null = null;

  // Rate limiting: minimal 1 detik antara request
  const now = Date.now();
  const timeSinceLastRequest = now - lastUsedTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`📤 Attempt ${attempt + 1} with key ${currentKeyIndex + 1}`);
      
      const model = geminiClient.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.7,
        }
      });
      
      const fullPrompt = `${persona}\n\nUser: ${prompt}\n\nAI Response:`;
      
      let result;
      if (imageBase64) {
        // Remove data URL prefix if present
        const base64Data = imageBase64.includes('base64,') 
          ? imageBase64.split('base64,')[1] 
          : imageBase64;
        
        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: imageBase64.includes('image/png') ? "image/png" : "image/jpeg"
          }
        };
        
        const textPart = { text: fullPrompt };
        result = await model.generateContent([textPart, imagePart]);
      } else {
        result = await model.generateContent(fullPrompt);
      }
      
      lastUsedTime = Date.now();
      const response = result.response.text();
      console.log(`✅ Success with key ${currentKeyIndex + 1}`);
      return response;
      
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // Cek berbagai jenis error
      const errorMessage = error.message?.toLowerCase() || '';
      const isRateLimit = errorMessage.includes('429') || 
                         errorMessage.includes('rate limit') || 
                         errorMessage.includes('quota') ||
                         errorMessage.includes('resource exhausted');
      
      const isKeyInvalid = errorMessage.includes('api key') || 
                          errorMessage.includes('permission') ||
                          errorMessage.includes('invalid');
      
      if (isRateLimit) {
        console.warn(`⏱️ Rate limit detected on key ${currentKeyIndex + 1}`);
        
        // Tunggu sebelum retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        
        // Coba rotate key
        if (rotateKey() && attempt < maxRetries - 1) {
          console.log(`🔄 Retrying with new key...`);
          continue;
        }
      } else if (isKeyInvalid) {
        console.warn(`🔑 Invalid key detected at index ${currentKeyIndex}`);
        
        // Hapus key yang tidak valid dari array
        availableKeys.splice(currentKeyIndex, 1);
        
        if (availableKeys.length === 0) {
          throw new Error("All API keys are invalid. Please add valid keys.");
        }
        
        // Reset index jika perlu
        currentKeyIndex = currentKeyIndex % availableKeys.length;
        geminiClient = new GoogleGenerativeAI(availableKeys[currentKeyIndex]);
        
        if (attempt < maxRetries - 1) {
          await delay(1000);
          continue;
        }
      } else {
        // Untuk error lain, tunggu sebentar lalu coba lagi dengan key yang sama
        if (attempt < maxRetries - 1) {
          await delay(2000);
          continue;
        }
      }
      
      // Jika semua retry gagal
      break;
    }
  }
  
  // Jika semua percobaan gagal
  throw lastError || new Error(`Failed to generate response after ${maxRetries} attempts. Please try again later.`);
};

// Export untuk debugging
export const getGeminiStatus = () => ({
  initialized: !!geminiClient,
  keyCount: availableKeys.length,
  currentKeyIndex,
  lastUsedTime
});
