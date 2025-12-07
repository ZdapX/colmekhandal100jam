
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserAccount, AppConfig } from '../types';

// Hardcoded credentials
const SUPABASE_URL = "https://srlirbbortnluolscsre.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybGlyYmJvcnRubHVvbHNjc3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODUyOTgsImV4cCI6MjA4MDY2MTI5OH0.IEyd1lmxfYMQDXYS7ecSvEPTAohW6D7JEIYJvF7xwyg";

let client: SupabaseClient | null = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
      client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      console.log("✅ Supabase client initialized");
  } else {
    console.warn("⚠️ Supabase URL or KEY missing");
  }
} catch (error) {
  console.error("❌ Supabase init failed:", error);
}

export const supabase = client;

// --- SESSION MANAGEMENT (LOCAL STORAGE) ---
const SESSION_KEY = 'CENTRAL_GPT_SESSION_V2';

export const saveSession = (user: UserAccount) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    console.log(`💾 Session saved for ${user.username}`);
  } catch (e) {
    console.error("Failed to save session", e);
  }
};

export const getSession = (): UserAccount | null => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (data) {
      const user = JSON.parse(data);
      console.log(`🔍 Session restored for ${user.username}`);
      return user;
    }
    return null;
  } catch (e) {
    console.error("Failed to restore session", e);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  console.log("🗑️ Session cleared");
};

// --- APP CONFIGURATION (SUPABASE DB) ---

export const fetchAppConfig = async (): Promise<Partial<AppConfig> | null> => {
  if (!supabase) {
    console.warn("⚠️ Supabase client not available for config fetch");
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      // Jika error karena data tidak ditemukan, buat config default
      if (error.code === 'PGRST116') {
        console.log("ℹ️ No config found, creating default...");
        return createDefaultConfig();
      }
      console.warn("⚠️ Config fetch warning:", error.message);
      return null;
    }
    
    if (!data) {
      console.log("ℹ️ Config empty, creating default...");
      return createDefaultConfig();
    }
    
    // PERBAIKAN: Pastikan gemini_keys selalu array dan valid
    let geminiKeys: string[] = [];
    if (data.gemini_keys) {
      if (Array.isArray(data.gemini_keys)) {
        // Filter keys yang valid (string dan tidak kosong)
        geminiKeys = data.gemini_keys
          .filter((k: any) => typeof k === 'string' && k.trim() !== '')
          .map((k: string) => k.trim());
      } else if (typeof data.gemini_keys === 'string') {
        // Jika string, split by comma atau newline
        const keys = data.gemini_keys.split(/[\n,]/)
          .map((k: string) => k.trim())
          .filter((k: string) => k !== '');
        geminiKeys = keys;
      }
    }
    
    console.log(`📋 Config loaded with ${geminiKeys.length} Gemini keys`);
    
    return {
      maintenanceMode: Boolean(data.maintenance_mode),
      featureVoice: Boolean(data.feature_voice),
      featureImage: Boolean(data.feature_image),
      geminiKeys: geminiKeys,
      deepseekKey: data.deepseek_key || ''
    };
  } catch (e) {
    console.error("❌ Error fetching app config:", e);
    return null;
  }
};

const createDefaultConfig = async (): Promise<Partial<AppConfig>> => {
  console.log("⚙️ Creating default config");
  const defaultConfig = {
    maintenanceMode: false,
    featureVoice: false,
    featureImage: true,
    geminiKeys: [],
    deepseekKey: ''
  };
  
  // Simpan default ke database jika supabase tersedia
  if (supabase) {
    try {
      const { error } = await supabase
        .from('app_config')
        .insert([{
          maintenance_mode: false,
          feature_voice: false,
          feature_image: true,
          gemini_keys: [],
          deepseek_key: ''
        }]);
      
      if (error) {
        console.warn("⚠️ Could not save default config:", error.message);
      } else {
        console.log("✅ Default config saved to database");
      }
    } catch (e) {
      console.error("❌ Error saving default config:", e);
    }
  }
  
  return defaultConfig;
};

export const updateAppConfig = async (config: Partial<AppConfig>) => {
  if (!supabase) {
    console.error("❌ Cannot update config: Supabase not available");
    return false;
  }
  
  try {
    // Persiapkan payload untuk database
    const dbPayload: any = {
      maintenance_mode: Boolean(config.maintenanceMode),
      feature_voice: Boolean(config.featureVoice),
      feature_image: Boolean(config.featureImage),
    };
    
    // Pastikan geminiKeys adalah array untuk database
    if (config.geminiKeys !== undefined) {
      dbPayload.gemini_keys = Array.isArray(config.geminiKeys) 
        ? config.geminiKeys 
        : (config.geminiKeys ? [config.geminiKeys] : []);
    }
    
    if (config.deepseekKey !== undefined) {
      dbPayload.deepseek_key = config.deepseekKey;
    }
    
    console.log("💾 Updating config in database...");
    
    // Cek apakah config sudah ada
    const { data: existingConfig } = await supabase
      .from('app_config')
      .select('id')
      .limit(1)
      .single()
      .catch(() => ({ data: null }));
    
    let result;
    if (existingConfig) {
      // Update existing config
      result = await supabase
        .from('app_config')
        .update(dbPayload)
        .eq('id', existingConfig.id);
    } else {
      // Insert new config
      result = await supabase
        .from('app_config')
        .insert([dbPayload]);
    }
    
    if (result.error) {
      console.error("❌ Error updating config:", result.error);
      return false;
    }
    
    console.log("✅ Config updated successfully");
    return true;
  } catch (e) {
    console.error("❌ Error updating config:", e);
    return false;
  }
};

// --- USER MANAGEMENT ---

export const checkSupabaseConnection = async () => {
  if (!supabase) {
    console.warn("⚠️ Supabase client not initialized");
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    // PGRST116 adalah error "no rows returned" yang normal untuk tabel kosong
    if (error && error.code !== 'PGRST116') {
      console.error("❌ Supabase connection test failed:", error.message);
      return false;
    }
    
    console.log("✅ Supabase connection successful");
    return true;
  } catch (e) {
    console.error("❌ Supabase connection test failed:", e);
    return false;
  }
};

export const verifyUserKey = async (keyInput: string): Promise<UserAccount | null> => {
  if (!supabase) {
    console.error("❌ Cannot verify key: Supabase not available");
    return null;
  }
  
  try {
    console.log(`🔑 Verifying key: ${keyInput.substring(0, 8)}...`);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('key', keyInput.trim())
      .single();

    if (error || !data) {
      console.warn("⚠️ Key verification failed");
      return null;
    }

    console.log(`✅ Key verified for user: ${data.username}`);
    
    return {
      id: data.id,
      username: data.username,
      key: data.key,
      aiName: data.ai_name || 'CentralGPT',
      devName: data.dev_name || 'XdpzQ',
      createdAt: data.created_at
    };
  } catch (err) {
    console.error("❌ Error verifying key:", err);
    return null;
  }
};

export const fetchUsers = async (): Promise<UserAccount[]> => {
  if (!supabase) {
    console.warn("⚠️ Cannot fetch users: Supabase not available");
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("❌ Error fetching users:", error);
      return [];
    }
    
    console.log(`📊 Fetched ${data?.length || 0} users`);
    
    return (data || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      key: u.key,
      aiName: u.ai_name || 'CentralGPT',
      devName: u.dev_name || 'XdpzQ',
      createdAt: u.created_at
    }));
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    return [];
  }
};

export const createUser = async (user: Omit<UserAccount, 'id' | 'createdAt'>): Promise<UserAccount | null> => {
  if (!supabase) {
    console.error("❌ Cannot create user: Supabase not available");
    return null;
  }
  
  try {
    const payload = {
      username: user.username.trim(),
      key: user.key.trim(),
      ai_name: user.aiName?.trim() || 'CentralGPT',
      dev_name: user.devName?.trim() || 'XdpzQ',
    };
    
    console.log(`👤 Creating user: ${payload.username}`);
    
    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select()
      .single();
    
    if (error) {
      console.error("❌ Error creating user:", error);
      return null;
    }
    
    console.log(`✅ User created: ${data.username} (ID: ${data.id})`);
    
    return {
      id: data.id,
      username: data.username,
      key: data.key,
      aiName: data.ai_name,
      devName: data.dev_name,
      createdAt: data.created_at
    };
  } catch (error) {
    console.error("❌ Error creating user:", error);
    return null;
  }
};

export const removeUser = async (id: string): Promise<boolean> => {
  if (!supabase) {
    console.error("❌ Cannot remove user: Supabase not available");
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("❌ Error removing user:", error);
      return false;
    }
    
    console.log(`🗑️ User ${id} removed`);
    return true;
  } catch (error) {
    console.error("❌ Error removing user:", error);
    return false;
  }
};
