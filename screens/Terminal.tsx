
import React, { useState, useRef, useEffect } from 'react';
import { UserAccount, ChatMessage, Screen, ChatHistoryItem } from '../types';
import { PERSONA_TEMPLATE, DEV_INFO_TEMPLATE } from '../constants';
import { generateResponse } from '../services/geminiService';

interface TerminalProps {
  currentUser: UserAccount | null;
  onNavigate: (screen: Screen) => void;
  config: { featureImage: boolean; featureVoice: boolean; maintenanceMode: boolean };
  onAddToHistory: (item: ChatHistoryItem) => void;
}

// Helper to extract code blocks
interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
  id?: string;
}

const Terminal: React.FC<TerminalProps> = ({ currentUser, onNavigate, config, onAddToHistory }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  // State for Script Viewer Modal
  const [viewingScript, setViewingScript] = useState<{title: string, lang: string, code: string} | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial connection message
  useEffect(() => {
    if (config.maintenanceMode) {
      setMessages([{
        role: 'system',
        text: 'SYSTEM ALERT: GLOBAL MAINTENANCE IN PROGRESS. ALL NEURAL LINKS SEVERED.',
        timestamp: Date.now()
      }]);
    } else {
        const devName = currentUser?.devName || 'XdpzQ';
        const aiName = currentUser?.aiName || 'CentralGPT';
        setMessages([{
            role: 'model',
            text: `Connection established with ${aiName}. Dev: ${devName}. Identity verified: ${currentUser?.username || 'GUEST'}. Perintah lo apa?`,
            timestamp: Date.now()
        }]);
    }
  }, [config.maintenanceMode, currentUser]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearChat = () => {
    const devName = currentUser?.devName || 'XdpzQ';
    setMessages([{
        role: 'system',
        text: `Console cleared. Dev: ${devName}. Ready for new input.`,
        timestamp: Date.now()
    }]);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Payload copied to clipboard.');
  };

  const parseMessageContent = (text: string): ParsedContent[] => {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: ParsedContent[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add preceding text
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }

      // Add code block as a card data
      const lang = match[1] || 'plaintext';
      parts.push({
        type: 'code',
        content: match[2],
        language: lang,
        id: Math.random().toString(36).substr(2, 9)
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return parts;
  };

  // Di dalam handleSend function:
const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();
  if ((!input.trim() && !selectedFile) || config.maintenanceMode || isThinking) return;

  const userMsg: ChatMessage = {
    role: 'user',
    text: input,
    image: filePreview || undefined,
    timestamp: Date.now()
  };

  setMessages(prev => [...prev, userMsg]);
  setInput('');
  setSelectedFile(null);
  setFilePreview(null);
  setIsThinking(true);

  const aiName = currentUser?.aiName || 'CentralGPT';
  const devName = currentUser?.devName || 'XdpzQ';
  
  const persona = PERSONA_TEMPLATE
    .replace(/{{AI_NAME}}/g, aiName)
    .replace(/{{DEV_NAME}}/g, devName);
  
  const devInfo = DEV_INFO_TEMPLATE
    .replace(/{{AI_NAME}}/g, aiName)
    .replace(/{{DEV_NAME}}/g, devName);

  try {
    // Cek jika pertanyaan tentang developer
    if (input.toLowerCase().includes('dev') || 
        input.toLowerCase().includes('siapa pencipta') || 
        input.toLowerCase().includes('created you') ||
        input.toLowerCase().includes('who created')) {
      
      setTimeout(() => {
        const responseText = devInfo;
        setMessages(prev => [...prev, {
          role: 'model',
          text: responseText,
          timestamp: Date.now()
        }]);
        
        // Log to History
        onAddToHistory({
          id: Date.now().toString(),
          username: currentUser?.username || 'GUEST',
          aiName: aiName,
          userMessage: userMsg.text,
          aiResponse: responseText,
          timestamp: new Date().toLocaleTimeString()
        });

        setIsThinking(false);
      }, 800);
      return;
    }

    console.log("🤖 Sending request to Gemini...");
    const responseText = await generateResponse(
      userMsg.text, 
      persona, 
      userMsg.image
    );

    setMessages(prev => [...prev, {
      role: 'model',
      text: responseText,
      timestamp: Date.now()
    }]);

    // Log to History
    onAddToHistory({
      id: Date.now().toString(),
      username: currentUser?.username || 'GUEST',
      aiName: aiName,
      userMessage: userMsg.text,
      aiResponse: responseText,
      timestamp: new Date().toLocaleTimeString()
    });

  } catch (error: any) {
    console.error("💥 Chat error:", error);
    
    // Error handling yang lebih baik
    let errorMessage = '';
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('quota')) {
      errorMessage = '⚠️ **API Rate Limit Exceeded**\n\nSilakan tunggu beberapa saat atau tambah lebih banyak API key di panel Admin.\n\nTips:\n1. Login sebagai admin (key: DAFAPUTRA)\n2. Buka Admin Panel → API Manager\n3. Tambah 3-5 API key dari Google AI Studio';
    } else if (errorMsg.includes('api key') || errorMsg.includes('invalid')) {
      errorMessage = '🔑 **API Key Configuration Error**\n\nAPI key tidak valid atau belum dikonfigurasi.\n\nSilakan konfigurasi API key:\n1. Login sebagai admin\n2. Tambah API key yang valid\n3. Restart aplikasi';
    } else if (errorMsg.includes('not configured')) {
      errorMessage = '⚙️ **System Configuration Required**\n\nGemini API belum dikonfigurasi.\n\nHubungi administrator untuk menambahkan API key.';
    } else {
      errorMessage = `❌ **System Error**\n\n${error.message || 'Unknown error occurred'}\n\nSilakan coba lagi atau hubungi support.`;
    }
    
    setMessages(prev => [...prev, {
      role: 'system',
      text: errorMessage,
      timestamp: Date.now()
    }]);
    
    // Juga log error ke history untuk debugging
    onAddToHistory({
      id: Date.now().toString(),
      username: currentUser?.username || 'GUEST',
      aiName: aiName,
      userMessage: userMsg.text,
      aiResponse: `ERROR: ${error.message || 'Unknown error'}`,
      timestamp: new Date().toLocaleTimeString()
    });
    
  } finally {
    setIsThinking(false);
  }
};
  const currentAiName = currentUser?.aiName?.toUpperCase() || 'CENTRALGPT';

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] container mx-auto p-4 md:p-6 relative">
      
      {/* SCRIPT VIEWER MODAL (Halaman Script) */}
      {viewingScript && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col animate-fade-in p-4 md:p-8">
            <div className="flex justify-between items-center mb-4 border-b border-central-secondary pb-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-pixel text-central-accent pixel-text-shadow">{viewingScript.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] md:text-xs font-mono bg-gray-800 text-white px-2 py-1 rounded">LANGUAGE: {viewingScript.lang.toUpperCase()}</span>
                        <span className="text-[10px] md:text-xs font-mono text-gray-500">SIZE: {viewingScript.code.length} BYTES</span>
                    </div>
                </div>
                <button 
                    onClick={() => setViewingScript(null)}
                    className="text-red-500 hover:text-white font-bold text-xl px-4"
                >
                    [CLOSE]
                </button>
            </div>
            
            <div className="flex-1 bg-[#0d0d0d] border border-gray-700 p-4 overflow-auto custom-scroll relative group">
                <button 
                    onClick={() => handleCopyCode(viewingScript.code)}
                    className="absolute top-4 right-4 bg-central-secondary text-white text-xs px-3 py-2 font-pixel opacity-50 group-hover:opacity-100 transition-opacity hover:bg-red-600 border border-black z-10"
                >
                    COPY RAW
                </button>
                <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                    <code>{viewingScript.code}</code>
                </pre>
            </div>
            
            <div className="mt-4 text-center text-gray-600 font-mono text-xs">
                // END OF FILE // GENERATED BY {currentAiName} //
            </div>
        </div>
      )}

      {/* Terminal Header - Custom AI Name Display */}
      <div className="flex justify-between items-end mb-4 bg-black/80 p-4 border border-central-accent pixel-border shadow-[0_0_15px_rgba(220,38,38,0.2)]">
        <div className="flex flex-col">
            <h1 className="font-pixel text-xl md:text-3xl text-central-accent pixel-text-shadow mb-1">
                {currentAiName} <span className="text-white text-base">TERMINAL</span>
            </h1>
            <div className="font-mono text-[10px] md:text-xs text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>ONLINE | USER: {currentUser?.username || 'GUEST'} | DEV: {currentUser?.devName || 'XdpzQ'}</span>
            </div>
        </div>
        <button onClick={clearChat} className="px-4 py-2 bg-red-900/50 text-white text-[10px] font-pixel border border-red-500 hover:bg-red-800 transition-colors">
            CLS / RESET
        </button>
      </div>

      {/* Chat Display */}
      <div className="flex-1 overflow-y-auto bg-black/90 border border-gray-800 p-4 mb-4 font-mono shadow-inner rounded relative termux-scroll">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-6 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block max-w-[90%] md:max-w-[80%] p-3 rounded-sm border ${
              msg.role === 'user' 
                ? 'bg-gray-800/50 border-gray-600 text-gray-200' 
                : msg.role === 'system'
                    ? 'bg-red-900/30 border-red-500 text-red-400 font-bold'
                    : 'bg-transparent border-none text-gray-200 pl-0' /* Changed text-green-400 to text-gray-200 for better aesthetic */
            }`}>
              {msg.image && (
                <img src={msg.image} alt="upload" className="max-w-[200px] h-auto mb-2 border border-gray-600 rounded" />
              )}
              
              <div className="whitespace-pre-wrap break-words text-sm md:text-base leading-relaxed">
                {msg.role === 'model' && <span className="text-central-accent font-bold mr-2 text-lg">➜</span>}
                
                {/* Message Parsing Logic */}
                {msg.role === 'model' ? (
                  parseMessageContent(msg.text).map((part, pIdx) => {
                    if (part.type === 'code') {
                      const projectTitle = `PROJECT_${part.language?.toUpperCase() || 'UNKNOWN'}_${part.id}`;
                      return (
                        <div key={pIdx} className="my-3 max-w-sm">
                           <div 
                             onClick={() => setViewingScript({
                                 title: projectTitle,
                                 lang: part.language || 'text',
                                 code: part.content
                             })}
                             className="group cursor-pointer bg-gray-900 border-l-4 border-central-accent p-4 hover:bg-gray-800 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none"
                           >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-pixel text-[10px] text-central-secondary">SECURE DATA CARD</span>
                                    <span className="text-gray-500 text-xs font-mono">[{part.language?.toUpperCase()}]</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-black border border-gray-700 flex items-center justify-center text-2xl">
                                        📄
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-white text-sm font-mono truncate">{projectTitle}</h4>
                                        <p className="text-[10px] text-gray-400 font-mono">Click to decrypt & view source</p>
                                    </div>
                                </div>
                           </div>
                        </div>
                      );
                    }
                    return <span key={pIdx}>{part.content}</span>;
                  })
                ) : (
                  msg.text
                )}

              </div>
            </div>
            <div className="text-[10px] text-gray-700 mt-1 uppercase font-pixel opacity-50">
                {msg.role === 'model' ? (currentUser?.aiName || 'CentralGPT') : 'YOU'} // {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="text-left animate-pulse flex items-center gap-2">
             <span className="text-central-accent font-bold text-lg">➜</span>
             <span className="text-central-accent font-mono text-sm">Thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Controls */}
      <form onSubmit={handleSend} className="relative bg-central-dark/95 p-4 border-t-2 border-central-accent flex flex-col gap-3 pixel-border">
        {config.maintenanceMode ? (
           <div className="text-center text-red-500 font-pixel text-sm py-4 bg-red-900/10 border border-red-500">SYSTEM MAINTENANCE ENABLED</div>
        ) : (
            <>
                {filePreview && (
                    <div className="absolute bottom-full left-0 bg-black/90 p-2 border border-gray-600 flex items-center gap-3 mb-2 rounded-t">
                        <img src={filePreview} alt="prev" className="h-12 w-12 object-cover border border-gray-700" />
                        <span className="text-xs text-gray-400 font-mono truncate max-w-[150px]">{selectedFile?.name}</span>
                        <button type="button" onClick={() => { setFilePreview(null); setSelectedFile(null); }} className="text-red-500 font-bold px-2 hover:text-red-400">X</button>
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <label className={`cursor-pointer p-3 border-2 border-dashed border-gray-600 hover:border-central-accent hover:bg-gray-900 transition-colors ${!config.featureImage ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`} title="Upload Image">
                        <span className="text-lg text-gray-400">📷</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} disabled={!config.featureImage} />
                    </label>
                    <div className="flex-1 relative">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type command..."
                            className="w-full bg-black/50 border border-gray-700 text-white font-mono p-3 focus:border-central-accent focus:outline-none focus:bg-black/80 transition-all h-12"
                        />
                    </div>
                    <button type="submit" className="px-6 h-12 bg-central-secondary text-white font-pixel text-xs border border-black hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isThinking || (!input && !selectedFile)}>
                        SEND
                    </button>
                </div>
            </>
        )}
      </form>
    </div>
  );
};

export default Terminal;
