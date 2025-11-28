import React, { useState } from 'react';
import { User, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Mail, Lock, User as UserIcon, ChevronRight, Loader2, WifiOff } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
  lang: Language;
}

// 修改为相对路径，依靠 Nginx 转发，自动适配 HTTP/HTTPS
const API_BASE_URL = '/api';

const Auth: React.FC<AuthProps> = ({ onLogin, lang }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New: Demo Mode state
  const [useMock, setUseMock] = useState(false);

  const t = TRANSLATIONS[lang].auth;

  // --- MOCK / DEMO MODE LOGIC ---
  const executeMockAuth = async () => {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
    
    // Simulate "Database" in localStorage
    const MOCK_DB_KEY = 'moveease_mock_users';
    const users = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '[]');
    
    if (isLogin) {
        const user = users.find((u: any) => u.email === email && u.password === password);
        if (user) {
            onLogin({ id: user.id, name: user.name, email: user.email, avatar: '' });
            return;
        } else {
            throw new Error(lang === 'zh' ? '账号或密码错误 (离线模式)' : 'Invalid email or password (Demo Mode)');
        }
    } else {
        if (users.find((u: any) => u.email === email)) {
            throw new Error(lang === 'zh' ? '邮箱已被注册 (离线模式)' : 'Email already exists (Demo Mode)');
        }
        const newUser = { id: Date.now().toString(), name, email, password };
        users.push(newUser);
        localStorage.setItem(MOCK_DB_KEY, JSON.stringify(users));
        onLogin({ id: newUser.id, name: newUser.name, email: newUser.email, avatar: '' });
        return;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password || (!isLogin && !name && !useMock)) {
      setError(t.fillAll);
      setIsLoading(false);
      return;
    }

    try {
      if (useMock) {
        await executeMockAuth();
      } else {
        // --- REAL SERVER LOGIC ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
            const endpoint = isLogin ? '/login' : '/register';
            const payload = isLogin 
                ? { email, password } 
                : { name, email, password };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // Check if response is JSON (if Nginx fails it might return HTML 404/502)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server configuration error (API Proxy)");
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Authentication failed');
            }

            if (data.user) {
                onLogin(data.user);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (networkError: any) {
            clearTimeout(timeoutId);
            console.warn("Network/Server error, switching to Mock Mode automatically:", networkError);
            
            // Auto-Switch to Mock Mode
            setUseMock(true);
            const fallbackMsg = lang === 'zh' 
                ? '无法连接服务器，已自动切换至离线模式。' 
                : 'Server unreachable. Switched to Offline Mode automatically.';
            setError(fallbackMsg);

            // Retry immediately with Mock Logic so user isn't stuck
            await executeMockAuth();
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.authError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 transform -rotate-6">
            <span className="text-4xl">🏃</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t.welcome}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">
          
          {/* Mode Indicator Banner */}
          {useMock && (
              <div className="absolute top-0 left-0 w-full bg-orange-100 text-orange-700 text-xs font-bold py-1 text-center flex items-center justify-center">
                  <WifiOff size={12} className="mr-1" />
                  {lang === 'zh' ? '离线演示模式' : 'Offline Demo Mode'}
              </div>
          )}

          <h2 className="text-xl font-bold text-gray-800 mb-6 mt-2">
            {isLogin ? t.login : t.register}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={t.name}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50"
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                placeholder={t.password}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-orange-50 p-3 rounded-lg animate-in fade-in border border-orange-100">
                 <p className="text-orange-600 text-xs font-medium text-center">
                    {error}
                 </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center mt-2 disabled:opacity-70 disabled:cursor-not-allowed ${useMock ? 'bg-orange-500 shadow-orange-200' : 'bg-indigo-600 shadow-indigo-200'}`}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  {isLogin ? t.login : t.register}
                  <ChevronRight size={20} className="ml-1 opacity-80" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              {isLogin ? t.noAccount : t.hasAccount}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                disabled={isLoading}
                className="text-indigo-600 font-bold hover:underline disabled:opacity-50"
              >
                {isLogin ? t.register : t.login}
              </button>
            </p>
          </div>

          {/* Mock Mode Toggle (Footer) */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-center">
             <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={useMock} 
                    onChange={(e) => {
                        setUseMock(e.target.checked);
                        setError('');
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                    {lang === 'zh' ? '手动启用离线演示模式' : 'Manually Enable Offline Demo Mode'}
                </span>
             </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;