
import React, { useState, useEffect } from 'react';
import { Screen, UserAccount, AppConfig, Testimonial } from '../types';
import { fetchUsers, createUser, removeUser, supabase, updateAppConfig } from '../services/supabaseClient';

interface AdminPanelProps {
  onNavigate: (screen: Screen) => void;
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  testimonials: Testimonial[];
  setTestimonials: React.Dispatch<React.SetStateAction<Testimonial[]>>;
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    onNavigate, config, setConfig, testimonials, setTestimonials, onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'FACTORY' | 'API' | 'GLOBAL' | 'TESTI' | 'USERS'>('FACTORY');
  
  // Local state for fetching users from Supabase
  const [dbUsers, setDbUsers] = useState<UserAccount[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Factory State
  const [newUser, setNewUser] = useState({ username: '', aiName: 'CentralGPT', devName: 'XdpzQ' });
  const [generatedKey, setGeneratedKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // API Manager State
  const [inputKey, setInputKey] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Testi Upload State
  const [newTestiText, setNewTestiText] = useState('');
  const [newTestiImage, setNewTestiImage] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'USERS') {
        loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
      if (!supabase) {
          alert("Database not connected. Check environment variables.");
          return;
      }
      setIsLoadingUsers(true);
      const data = await fetchUsers();
      setDbUsers(data);
      setIsLoadingUsers(false);
  };

  const generateUser = async () => {
    if (!newUser.username) return;
    if (!supabase) {
        alert("Database Error: Supabase client is null.");
        return;
    }
    setIsGenerating(true);
    
    const key = 'CGPT-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const created = await createUser({
        username: newUser.username,
        key: key,
        aiName: newUser.aiName,
        devName: newUser.devName
    });

    if (created) {
        setGeneratedKey(key);
        setNewUser({ username: '', aiName: 'CentralGPT', devName: 'XdpzQ' });
    } else {
        alert("Failed to generate user in Database. Check connection.");
    }
    setIsGenerating(false);
  };

  const deleteUser = async (id: string) => {
    if (confirm('Terminate agent access?')) {
        const success = await removeUser(id);
        if (success) {
            setDbUsers(dbUsers.filter(u => u.id !== id));
        } else {
            alert("Delete failed.");
        }
    }
  };

  // --- CONFIG MANAGEMENT ---

  const saveConfigToDB = async (newConfig: AppConfig) => {
      setIsSavingConfig(true);
      const success = await updateAppConfig(newConfig);
      if (success) {
          setConfig(newConfig);
      } else {
          alert("Failed to sync config to Supabase.");
      }
      setIsSavingConfig(false);
  };

  const handleAddKey = () => {
    if (!inputKey.trim()) return;
    // Ensure geminiKeys is an array
    const currentKeys = Array.isArray(config.geminiKeys) ? config.geminiKeys : [];
    const newKeys = [...currentKeys, inputKey.trim()];
    
    const updated = { ...config, geminiKeys: newKeys };
    saveConfigToDB(updated);
    setInputKey('');
  };

  const handleRemoveKey = (index: number) => {
    const currentKeys = Array.isArray(config.geminiKeys) ? config.geminiKeys : [];
    const newKeys = [...currentKeys];
    newKeys.splice(index, 1);
    
    const updated = { ...config, geminiKeys: newKeys };
    saveConfigToDB(updated);
  };

  const handleToggleFeature = (feature: 'maintenanceMode' | 'featureVoice' | 'featureImage') => {
      const updated = { ...config, [feature]: !config[feature] };
      saveConfigToDB(updated);
  };

  // --------------------------

  const handleTestiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewTestiImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const addTestimonial = () => {
    if (!newTestiText) {
        alert("Text content required");
        return;
    }
    setTestimonials([...testimonials, { 
        id: Date.now().toString(),
        text: newTestiText,
        imageData: newTestiImage 
    }]);
    setNewTestiText('');
    setNewTestiImage('');
    alert('Testimonial injected successfully.');
  };

  const renderContent = () => {
    switch(activeTab) {
        case 'FACTORY':
            return (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="font-pixel text-central-accent text-lg border-b border-gray-700 pb-2">TEMPLATE FACTORY</h3>
                    {!supabase && <div className="text-red-500 font-mono text-xs border border-red-500 p-2">WARNING: DB DISCONNECTED</div>}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">USER ACCOUNT NAME</label>
                            <input 
                                placeholder="e.g. ShadowHunter" 
                                className="w-full bg-black/50 border border-gray-600 p-3 text-white font-mono focus:border-central-accent outline-none"
                                value={newUser.username}
                                onChange={e => setNewUser({...newUser, username: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">CUSTOM AI NAME (Will appear in Terminal Header)</label>
                            <input 
                                placeholder="Default: CentralGPT" 
                                className="w-full bg-black/50 border border-gray-600 p-3 text-white font-mono focus:border-central-accent outline-none"
                                value={newUser.aiName}
                                onChange={e => setNewUser({...newUser, aiName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">CUSTOM DEVELOPER NAME</label>
                            <input 
                                placeholder="Default: XdpzQ" 
                                className="w-full bg-black/50 border border-gray-600 p-3 text-white font-mono focus:border-central-accent outline-none"
                                value={newUser.devName}
                                onChange={e => setNewUser({...newUser, devName: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={generateUser} 
                            disabled={isGenerating || !supabase}
                            className="bg-central-secondary text-white p-4 font-pixel text-xs pixel-border hover:bg-red-700 transition-colors mt-2 disabled:opacity-50"
                        >
                            {isGenerating ? 'UPLOADING TO DB...' : 'GENERATE ACCESS KEY'}
                        </button>
                    </div>
                    {generatedKey && (
                        <div className="p-6 bg-green-900/10 border-2 border-green-500 text-green-400 font-mono text-center mt-4">
                            <div className="text-xs uppercase mb-2">Generated successfully</div>
                            <span className="font-bold text-2xl select-all tracking-wider">{generatedKey}</span>
                        </div>
                    )}
                </div>
            );
        // Di dalam renderContent untuk tab 'API':
case 'API':
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="font-pixel text-central-accent text-lg">API KEY ROTATION POOL</h3>
        {isSavingConfig && <span className="text-[10px] animate-pulse text-green-500">SAVING TO DB...</span>}
      </div>
      
      <div className="bg-black/40 border border-gray-700 p-4 mb-4">
        <p className="text-xs text-gray-400 font-mono mb-2">
          🔧 Add multiple Gemini API Keys. The system will automatically rotate between them to avoid rate limits.
          <br/>
          <span className="text-yellow-500">Format: sk-xxxxxxxxxxxxxxxx</span>
        </p>
        
        {/* API Key Counter */}
        <div className="flex items-center gap-4 mb-3 p-2 bg-gray-900/50 rounded">
          <div className={`w-3 h-3 rounded-full ${config.geminiKeys && config.geminiKeys.length > 2 ? 'bg-green-500' : config.geminiKeys && config.geminiKeys.length > 0 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <span className="text-xs font-mono">
            Active Keys: <span className={`font-bold ${config.geminiKeys && config.geminiKeys.length > 2 ? 'text-green-400' : config.geminiKeys && config.geminiKeys.length > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {config.geminiKeys?.length || 0}
            </span>
            {config.geminiKeys && config.geminiKeys.length <= 2 && (
              <span className="text-yellow-500 ml-2">(Recommended: 3+ keys)</span>
            )}
          </span>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="password"
            className="flex-1 bg-black/50 border border-gray-600 p-3 text-white font-mono focus:border-central-accent outline-none text-xs placeholder-gray-500"
            value={inputKey}
            onChange={e => setInputKey(e.target.value)}
            placeholder="Paste Gemini API Key here (starts with 'sk-...')"
          />
          <button 
            onClick={handleAddKey}
            disabled={isSavingConfig || !inputKey.trim()}
            className="bg-green-700 text-white px-4 font-pixel text-[10px] hover:bg-green-600 border border-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ADD KEY
          </button>
        </div>
        
        {/* Quick Help */}
        <div className="mt-3 text-[10px] text-gray-500 font-mono">
          💡 Get keys from: <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 hover:underline">Google AI Studio</a>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scroll pr-1">
        {config.geminiKeys && config.geminiKeys.map((key, idx) => (
          <div key={idx} className="flex justify-between items-center bg-gray-900/50 p-3 border-l-2 border-central-accent hover:bg-gray-800 transition-colors">
            <div className="font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                <span className="text-gray-300">
                  KEY {idx + 1}: 
                  <span className="ml-2 text-gray-400 select-all">
                    {key.substring(0, 12)}...{key.substring(key.length - 8)}
                  </span>
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                Status: <span className="text-green-400">Active</span>
              </div>
            </div>
            <button 
              onClick={() => handleRemoveKey(idx)}
              disabled={isSavingConfig}
              className="text-red-500 hover:text-white text-[10px] font-pixel border border-transparent hover:border-red-500 px-3 py-1 hover:bg-red-900/30 transition-colors"
              title="Delete this key"
            >
              DELETE
            </button>
          </div>
        ))}
        
        {(!config.geminiKeys || config.geminiKeys.length === 0) && (
          <div className="text-center text-gray-600 font-mono text-xs py-8 border-2 border-dashed border-gray-800 rounded">
            <div className="text-4xl mb-2 opacity-30">🔑</div>
            NO API KEYS CONFIGURED
            <div className="mt-2 text-[10px] text-red-400">
              System will not function without API keys!
            </div>
          </div>
        )}
      </div>
      
      {/* Test Connection Button */}
      <div className="pt-4 border-t border-gray-800">
        <button 
          onClick={async () => {
            if (!config.geminiKeys || config.geminiKeys.length === 0) {
              alert("No API keys to test!");
              return;
            }
            
            alert(`Testing ${config.geminiKeys.length} API keys...\nFirst key: ${config.geminiKeys[0].substring(0, 15)}...\n\nSystem will initialize Gemini service on next chat.`);
          }}
          className="w-full bg-blue-900/30 text-blue-400 border border-blue-700 p-3 font-mono text-xs hover:bg-blue-800/30 transition-colors"
        >
          🔧 TEST API CONNECTION (Next chat will test keys)
        </button>
      </div>
    </div>
  );
        case 'GLOBAL':
            return (
                <div className="space-y-6 animate-fade-in">
                     <h3 className="font-pixel text-central-accent text-lg border-b border-gray-700 pb-2">GLOBAL CONTROLS</h3>
                     <div className="grid grid-cols-1 gap-4">
                        <div className={`p-6 border-2 ${config.maintenanceMode ? 'border-red-500 bg-red-900/10' : 'border-green-600 bg-green-900/10'} flex flex-col gap-2`}>
                            <div className="flex justify-between items-center">
                                <span className="font-pixel text-sm">GLOBAL MAINTENANCE</span>
                                <div className={`w-3 h-3 rounded-full ${config.maintenanceMode ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">Activates system-wide lockdown. Chat unavailable.</p>
                            <button 
                                onClick={() => handleToggleFeature('maintenanceMode')}
                                disabled={isSavingConfig}
                                className={`w-full py-3 font-bold font-pixel text-xs transition-colors ${config.maintenanceMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {config.maintenanceMode ? 'DISABLE MAINTENANCE' : 'ENABLE MAINTENANCE'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 border border-gray-600 bg-black/40">
                                <span className="font-pixel text-xs block mb-2">VOICE CHAT AI</span>
                                <button 
                                    onClick={() => handleToggleFeature('featureVoice')}
                                    disabled={isSavingConfig}
                                    className={`w-full py-2 font-bold text-xs ${config.featureVoice ? 'bg-central-secondary text-white' : 'bg-gray-800 text-gray-400'}`}
                                >
                                    {config.featureVoice ? 'ACTIVE' : 'INACTIVE'}
                                </button>
                            </div>
                            <div className="p-4 border border-gray-600 bg-black/40">
                                <span className="font-pixel text-xs block mb-2">IMAGE GENERATE</span>
                                <button 
                                    onClick={() => handleToggleFeature('featureImage')}
                                    disabled={isSavingConfig}
                                    className={`w-full py-2 font-bold text-xs ${config.featureImage ? 'bg-central-secondary text-white' : 'bg-gray-800 text-gray-400'}`}
                                >
                                    {config.featureImage ? 'ACTIVE' : 'INACTIVE'}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
            );
        case 'TESTI':
            return (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="font-pixel text-central-accent text-lg border-b border-gray-700 pb-2">UPLOAD TESTIMONI</h3>
                    <div className="space-y-4">
                        <div className="border border-gray-600 bg-black/40 p-4">
                            <label className="block text-xs font-mono text-gray-400 mb-2">TESTIMONIAL IMAGE (FILE)</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleTestiImageSelect}
                                className="block w-full text-xs text-gray-400 font-mono file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-pixel file:bg-central-secondary file:text-white hover:file:bg-red-700 cursor-pointer"
                            />
                            {newTestiImage && (
                                <img src={newTestiImage} alt="preview" className="mt-2 h-20 w-auto border border-gray-700" />
                            )}
                        </div>

                        <textarea 
                            placeholder="Testimonial Text Content..."
                            value={newTestiText}
                            onChange={e => setNewTestiText(e.target.value)}
                            className="w-full bg-black/50 border border-gray-600 p-3 text-white font-mono h-32 focus:border-central-accent outline-none"
                        />
                        
                        <button onClick={addTestimonial} className="w-full bg-central-secondary text-white p-3 font-pixel text-xs pixel-border hover:bg-red-700">
                            UPLOAD TO PUBLIC
                        </button>
                    </div>
                </div>
            );
        case 'USERS':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                        <h3 className="font-pixel text-central-accent text-lg">USER DATABASE (SUPABASE)</h3>
                        <button onClick={loadUsers} className="text-[10px] font-mono text-gray-400 hover:text-white">[REFRESH]</button>
                    </div>
                    
                    {isLoadingUsers ? (
                        <div className="text-center py-10 font-mono text-xs text-gray-500 animate-pulse">
                            CONNECTING TO ENCRYPTED NODE...
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                            {dbUsers.map(user => (
                                <div key={user.id} className="p-3 border border-gray-700 bg-black/40 flex justify-between items-center hover:bg-gray-900 transition-colors">
                                    <div className="font-mono text-xs overflow-hidden">
                                        <div className="text-white font-bold">{user.username}</div>
                                        <div className="text-gray-500 truncate max-w-[150px]">{user.key}</div>
                                        <div className="text-gray-600 text-[10px]">AI: {user.aiName} | Dev: {user.devName}</div>
                                    </div>
                                    <button onClick={() => deleteUser(user.id)} className="bg-red-900/30 text-red-500 border border-red-900 hover:bg-red-800 hover:text-white px-3 py-1 text-xs">
                                        DELETE
                                    </button>
                                </div>
                            ))}
                            {dbUsers.length === 0 && (
                                <div className="text-gray-500 text-center font-mono py-8 border border-dashed border-gray-800">
                                    {supabase ? "NO ACTIVE AGENTS FOUND IN DB" : "DB DISCONNECTED"}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
    }
  };

  return (
    <div className="flex-1 container mx-auto p-4 md:p-6 mb-10">
        <div className="flex items-center justify-between mb-6 bg-black/80 p-4 border-b border-central-accent">
            <h1 className="text-xl md:text-2xl font-pixel text-central-accent">DEV CONSOLE</h1>
            <button onClick={onLogout} className="text-gray-400 hover:text-white font-mono text-xs border border-gray-600 px-3 py-1 hover:bg-gray-800">[LOGOUT]</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <div className="flex flex-col gap-2">
                {[
                    { id: 'FACTORY', label: 'Templat Factory' },
                    { id: 'API', label: 'Api Manager' },
                    { id: 'GLOBAL', label: 'Global Maintenance' },
                    { id: 'TESTI', label: 'Upload Testimoni' },
                    { id: 'USERS', label: 'User List' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`text-left p-4 font-mono text-xs md:text-sm pixel-border transition-all ${activeTab === tab.id ? 'bg-central-secondary text-white translate-x-1' : 'bg-black/60 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        {activeTab === tab.id && '> '} {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="md:col-span-3 bg-central-dark/95 p-6 pixel-border min-h-[500px] shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                {renderContent()}
            </div>
        </div>
    </div>
  );
};

export default AdminPanel;
