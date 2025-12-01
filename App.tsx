
import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import WorkoutCard from './components/WorkoutCard';
import WorkoutPlayer from './components/WorkoutPlayer';
import DNDManager from './components/DNDManager';
import Auth from './components/Auth';
import Announcements from './components/Announcements';
import { AppView, Exercise, UserSettings, User, DailyStat, UserStats, Quote } from './types';
import { TRANSLATIONS, getMockExercises, getBadges, INSPIRATIONAL_QUOTES } from './constants';
import { generateSmartWorkout } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Play, Pause, RefreshCw, Smartphone, Award, ChevronRight, Zap, Moon, Globe, LogOut, Bell, Edit2, Camera, Loader2, Quote as QuoteIcon } from 'lucide-react';

const SETTINGS_KEY = 'moveease_settings_v1';
const TIMER_KEY = 'moveease_timer_v1';
const SESSION_KEY = 'moveease_user_session';

// Helper for days
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      return savedSession ? JSON.parse(savedSession) : null;
    } catch (e) {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [showAnnouncements, setShowAnnouncements] = useState(false);

  const getUserKey = (key: string) => {
    return currentUser ? `${key}_${currentUser.id}` : key;
  };

  // 1. Initialize Settings
  const [userSettings, setUserSettings] = useState<UserSettings>({
      sedentaryThreshold: 45,
      notificationsEnabled: true,
      doNotDisturb: { schedules: [], calendarSync: false, smartDetection: true },
      language: 'zh'
    });

  // 2. Initialize Timer & Stats
  const [sedentaryTime, setSedentaryTime] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [weeklyStats, setWeeklyStats] = useState<DailyStat[]>([]);
  
  // 3. User Gamification Stats
  const [userStats, setUserStats] = useState<UserStats>({
      totalWorkouts: 0,
      currentStreak: 0,
      lastWorkoutDate: null
  });

  // 4. Daily Quote
  const [dailyQuote, setDailyQuote] = useState<Quote>(INSPIRATIONAL_QUOTES[0]);

  // --- API SYNC FUNCTIONS ---

  // Fetch stats from server
  const fetchStats = async (userId: string) => {
      try {
          const res = await fetch(`/api/stats?userId=${userId}`);
          if (res.ok) {
              const data = await res.json();
              
              // 1. Set User Stats (Badges/Streak)
              setUserStats({
                  totalWorkouts: data.stats.total_workouts || 0,
                  currentStreak: data.stats.current_streak || 0,
                  lastWorkoutDate: data.stats.last_workout_date ? data.stats.last_workout_date.split('T')[0] : null
              });

              // 2. Set Weekly Stats (Chart)
              // Transform DB activity rows into Mon-Sun format
              const today = new Date();
              const last7Days = Array.from({length: 7}, (_, i) => {
                  const d = new Date(today);
                  d.setDate(d.getDate() - (6 - i));
                  return d.toISOString().split('T')[0]; // YYYY-MM-DD
              });

              const chartData = last7Days.map(dateStr => {
                  const dayRecord = data.activity.find((a: any) => a.activity_date.startsWith(dateStr));
                  const dateObj = new Date(dateStr);
                  return {
                      day: DAYS[dateObj.getDay()], // Sun, Mon...
                      dateFull: dateStr,
                      sedentaryHours: dayRecord ? Number((dayRecord.sedentary_minutes / 60).toFixed(1)) : 0,
                      activeBreaks: dayRecord ? dayRecord.active_breaks : 0
                  };
              });
              setWeeklyStats(chartData);
          }
      } catch (e) {
          console.error("Failed to fetch stats", e);
      }
  };

  // Sync stats to server
  const syncStats = async (stats: UserStats, todaySedentarySeconds: number, todayBreaks: number) => {
      if (!currentUser) return;
      try {
          await fetch('/api/stats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userId: currentUser.id,
                  totalWorkouts: stats.totalWorkouts,
                  currentStreak: stats.currentStreak,
                  lastWorkoutDate: stats.lastWorkoutDate,
                  todaySedentaryMinutes: Math.floor(todaySedentarySeconds / 60),
                  todayBreaks: todayBreaks
              })
          });
      } catch (e) {
          console.error("Sync failed", e);
      }
  };

  // --- EFFECTS ---

  // Load User Data
  useEffect(() => {
    if (!currentUser) return;

    // A. Load Settings
    const savedSettings = localStorage.getItem(getUserKey(SETTINGS_KEY));
    if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings));
    }

    // B. Load Timer (Bug 4 Fix: No elapsed time calculation)
    const savedTimer = localStorage.getItem(getUserKey(TIMER_KEY));
    if (savedTimer) {
        const { time, monitoring } = JSON.parse(savedTimer);
        setSedentaryTime(time);
        setIsMonitoring(monitoring);
    } else {
        setSedentaryTime(0);
        setIsMonitoring(true);
    }

    // C. Fetch Remote Stats
    fetchStats(currentUser.id);

    // Set Random Quote
    const quoteIndex = new Date().getDate() % INSPIRATIONAL_QUOTES.length;
    setDailyQuote(INSPIRATIONAL_QUOTES[quoteIndex] || INSPIRATIONAL_QUOTES[0]);

  }, [currentUser]); 

  // Persist Settings
  useEffect(() => {
    if (currentUser) {
        localStorage.setItem(getUserKey(SETTINGS_KEY), JSON.stringify(userSettings));
    }
  }, [userSettings, currentUser]);

  const lang = userSettings.language;
  const t = TRANSLATIONS[lang];

  // UI State
  const [showDNDManager, setShowDNDManager] = useState(false);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDNDActive, setIsDNDActive] = useState(false);
  const [activeDNDLabel, setActiveDNDLabel] = useState<string>('');
  const [alertLevel, setAlertLevel] = useState(0); 
  const threshold = userSettings.sedentaryThreshold * 60; 

  // Initialize Alert Level
  useEffect(() => {
    if (sedentaryTime > threshold + 300) setAlertLevel(2);
    else if (sedentaryTime > threshold) setAlertLevel(1);
    else setAlertLevel(0);
  }, [sedentaryTime, threshold]);

  // Workout State
  const [exercises, setExercises] = useState<Exercise[]>(getMockExercises(lang));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setExercises(getMockExercises(lang));
  }, [lang]);

  // Check DND Status logic
  useEffect(() => {
    const checkDND = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      let dndActive = false;
      let label = '';

      for (const schedule of userSettings.doNotDisturb.schedules) {
        if (!schedule.isEnabled) continue;
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        if (startTotal <= endTotal) {
            if (currentMinutes >= startTotal && currentMinutes < endTotal) {
                dndActive = true;
                label = schedule.label;
                break;
            }
        } else {
            if (currentMinutes >= startTotal || currentMinutes < endTotal) {
                dndActive = true;
                label = schedule.label;
                break;
            }
        }
      }

      if (!dndActive && userSettings.doNotDisturb.smartDetection) {
         if (currentMinutes >= 13 * 60 && currentMinutes < 13 * 60 + 30) {
             dndActive = true;
             label = `🧠 ${lang === 'zh' ? '智能感知 (午休)' : 'Smart Detect (Lunch)'}`;
         }
      }

      setIsDNDActive(dndActive);
      setActiveDNDLabel(label);
    };

    checkDND();
    const interval = setInterval(checkDND, 10000);
    return () => clearInterval(interval);
  }, [userSettings.doNotDisturb, lang]);

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isMonitoring && !isDNDActive && !activeExercise && currentUser) {
      interval = setInterval(() => {
        setSedentaryTime((prev: number) => {
          const newValue = prev + 1;
          localStorage.setItem(getUserKey(TIMER_KEY), JSON.stringify({
            time: newValue,
            monitoring: true,
            // lastActive Removed to fix Bug 4 (no catch up)
          }));
          return newValue;
        });
      }, 1000);
    } else if (currentUser) {
      localStorage.setItem(getUserKey(TIMER_KEY), JSON.stringify({
        time: sedentaryTime,
        monitoring: isMonitoring
      }));
    }
    return () => clearInterval(interval);
  }, [isMonitoring, isDNDActive, activeExercise, sedentaryTime, currentUser]);

  const handleWorkoutComplete = () => {
      if (!currentUser) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = userStats.currentStreak;
      // Streak logic
      if (userStats.lastWorkoutDate === yesterdayStr) {
          newStreak += 1;
      } else if (userStats.lastWorkoutDate !== todayStr) {
          newStreak = 1; 
      }

      const newStats = {
          totalWorkouts: userStats.totalWorkouts + 1,
          currentStreak: newStreak,
          lastWorkoutDate: todayStr
      };
      setUserStats(newStats);

      // Update Chart locally
      const todayIndex = 6; // Assume last item is today for simplicity in this array context
      const newWeeklyStats = [...weeklyStats];
      if (newWeeklyStats[todayIndex]) {
          newWeeklyStats[todayIndex].activeBreaks += 1;
          setWeeklyStats(newWeeklyStats);
      }

      // Reset Timer & Sync to DB
      const currentSedentaryMinutes = Math.floor(sedentaryTime / 60); // Bank current minutes before reset
      // Note: We need to add the *current session* to the DB total. 
      // Simplified: We assume chart data has previous total, we add current session.
      // But actually, chart data comes from DB. 
      // For accurate sync, we should pass (Existing DB Sedentary + Current Session)
      // Since we don't track total cumulative day minutes in React state easily without another variable,
      // We will assume `weeklyStats[today].sedentaryHours` * 60 + `sedentaryTime` / 60 is the total.
      
      const prevTotalMinutes = (newWeeklyStats[todayIndex]?.sedentaryHours || 0) * 60;
      const totalMinutesToday = Math.floor(prevTotalMinutes + (sedentaryTime / 60));
      const totalBreaksToday = newWeeklyStats[todayIndex]?.activeBreaks || 1;

      syncStats(newStats, totalMinutesToday, totalBreaksToday);
      resetTimer();
  };

  const resetTimer = () => {
    // Before resetting, sync the sedentary time to DB
    if (currentUser && weeklyStats.length > 0) {
        const todayIndex = weeklyStats.length - 1;
        const prevTotalMinutes = (weeklyStats[todayIndex]?.sedentaryHours || 0) * 60;
        const totalMinutesToday = Math.floor(prevTotalMinutes + (sedentaryTime / 60));
        const totalBreaksToday = weeklyStats[todayIndex]?.activeBreaks || 0;
        
        syncStats(userStats, totalMinutesToday, totalBreaksToday);
    }

    setSedentaryTime(0);
    setAlertLevel(0);
    if (currentUser) {
        localStorage.setItem(getUserKey(TIMER_KEY), JSON.stringify({
            time: 0,
            monitoring: isMonitoring
        }));
    }
  };

  const handleGenerateWorkout = async () => {
    setIsGenerating(true);
    const newPlan = await generateSmartWorkout('neck', lang);
    setExercises(newPlan);
    setIsGenerating(false);
  };

  const toggleLanguage = () => {
    setUserSettings(prev => ({
        ...prev,
        language: prev.language === 'en' ? 'zh' : 'en'
    }));
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    setCurrentView(AppView.HOME);
    setSedentaryTime(0);
    setWeeklyStats([]);
    setUserStats({ totalWorkouts: 0, currentStreak: 0, lastWorkoutDate: null });
  };

  const handleUpdateProfile = async () => {
      if (!currentUser) return;
      setIsSavingProfile(true);
      try {
          const response = await fetch('/api/update-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: currentUser.id,
                  name: editName,
                  avatar: editAvatar
              })
          });
          
          if (!response.ok) throw new Error('Failed to update');
          
          const updatedUser = { ...currentUser, name: editName, avatar: editAvatar };
          setCurrentUser(updatedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
          setIsEditingProfile(false);
      } catch (e) {
          console.error(e);
          alert('Failed to update profile');
      } finally {
          setIsSavingProfile(false);
      }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getProgressColor = () => {
    if (isDNDActive) return 'stroke-indigo-200'; 
    if (!isMonitoring) return 'stroke-gray-300';
    if (sedentaryTime < threshold * 0.5) return 'stroke-green-500';
    if (sedentaryTime < threshold * 0.9) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  // --- VIEWS ---

  const renderHome = () => {
    const progress = Math.min((sedentaryTime / threshold) * 100, 100);
    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center pt-8 px-6 min-h-screen bg-gray-50">
        <header className="w-full flex justify-between items-center mb-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">SitClock</h1>
                <p className="text-sm text-gray-500">
                    {isDNDActive ? t.home.paused : t.home.tracking}
                </p>
            </div>
            <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setShowAnnouncements(true)}
                  className="p-2 rounded-full bg-white text-gray-500 shadow-sm border border-gray-100 hover:text-indigo-600 active:scale-95 transition-all relative"
                >
                    <Bell size={20} />
                </button>
                <div className={`p-2 rounded-full transition-colors ${isDNDActive ? 'bg-indigo-100 text-indigo-600' : (isMonitoring ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500')}`}>
                    {isDNDActive ? <Moon size={20} className="fill-indigo-600" /> : <Smartphone size={20} />}
                </div>
            </div>
        </header>

        {/* Circular Timer */}
        <div className="relative mb-10">
            <svg className="transform -rotate-90 w-72 h-72">
                <circle
                    cx="144"
                    cy="144"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="15"
                    fill="transparent"
                    className="text-gray-200"
                />
                <circle
                    cx="144"
                    cy="144"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="15"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ease-linear ${getProgressColor()}`}
                />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                {isDNDActive ? (
                   <Moon size={48} className="text-indigo-300 mx-auto mb-2" />
                ) : (
                   <div className="text-5xl font-bold text-gray-800 font-mono tracking-tighter">
                       {formatTime(sedentaryTime)}
                   </div>
                )}
                <div className="text-gray-500 text-sm mt-1 font-medium">
                    {isDNDActive ? t.home.zzz : t.home.sedentaryTime}
                </div>
            </div>
        </div>

        {/* Status Indicator Area */}
        {isDNDActive ? (
            <div className="w-full max-w-xs mb-8 bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col items-center justify-center text-center animate-pulse">
                <div className="flex items-center text-indigo-800 font-bold mb-1">
                    <span className="text-lg mr-2">{t.home.dndActive}</span>
                </div>
                <div className="bg-white/60 px-3 py-1 rounded-full text-sm font-semibold text-indigo-700 border border-indigo-100 mt-2">
                    {activeDNDLabel}
                </div>
                <p className="text-xs text-indigo-400 mt-2">{t.home.autoPaused}</p>
            </div>
        ) : (
            <div className="flex space-x-4 w-full max-w-xs mb-8">
                <button 
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    className={`flex-1 py-4 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm transition-transform active:scale-95 ${isMonitoring ? 'bg-white text-gray-700 border border-gray-200' : 'bg-indigo-600 text-white'}`}
                >
                    {isMonitoring ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                    {isMonitoring ? t.home.pause : t.home.resume}
                </button>
                <button 
                    onClick={resetTimer}
                    className="flex-1 bg-white border border-gray-200 text-indigo-600 py-4 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm active:bg-indigo-50 transition-colors"
                >
                    <RefreshCw className="mr-2" />
                    {t.home.moved}
                </button>
            </div>
        )}

        {/* Alert Card */}
        {alertLevel > 0 && !isDNDActive && (
             <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-start animate-pulse">
                <Zap className="text-red-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-red-700">{t.home.timeToMove}</h3>
                    <p className="text-sm text-red-600">
                        {t.home.moveDesc.replace('{min}', userSettings.sedentaryThreshold.toString())}
                    </p>
                </div>
             </div>
        )}
      </div>
    );
  };

  const renderWorkouts = () => (
    <div className="px-4 py-8 min-h-screen bg-gray-50 pb-24">
       <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.workouts.title}</h2>
       
       <div className="bg-indigo-600 rounded-2xl p-5 mb-8 text-white shadow-lg shadow-indigo-200">
            <h3 className="font-bold text-lg mb-2 flex items-center">
                <Zap className="mr-2 fill-yellow-400 text-yellow-400" size={20}/> 
                {t.workouts.generatorTitle}
            </h3>
            <p className="text-indigo-100 text-sm mb-4">{t.workouts.generatorDesc}</p>
            <button 
                onClick={handleGenerateWorkout}
                disabled={isGenerating}
                className="w-full bg-white text-indigo-700 font-bold py-2.5 rounded-lg flex items-center justify-center disabled:opacity-70"
            >
                {isGenerating ? (
                   <span className="flex items-center"><RefreshCw className="animate-spin mr-2" size={18}/> {t.workouts.generating}</span>
                ) : t.workouts.generateBtn}
            </button>
       </div>

       <div className="space-y-4">
            <h3 className="font-bold text-gray-700 mb-2">{t.workouts.recommended}</h3>
            {exercises.map((ex) => (
                <WorkoutCard 
                    key={ex.id} 
                    exercise={ex}
                    lang={lang}
                    onPlay={() => setActiveExercise(ex)} 
                />
            ))}
       </div>
    </div>
  );

  const renderStats = () => {
    // [Fix Bug 1] Merge current running time into chart data for visualization
    const chartData = [...weeklyStats];
    const todayIndex = chartData.length - 1; // Last item is today
    if (chartData[todayIndex]) {
        const currentHours = sedentaryTime / 3600;
        chartData[todayIndex] = {
            ...chartData[todayIndex],
            sedentaryHours: Number((chartData[todayIndex].sedentaryHours + currentHours).toFixed(1))
        };
    }

    return (
    <div className="px-4 py-8 min-h-screen bg-gray-50 pb-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.stats.title}</h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">{t.stats.todaySedentary}</p>
                <p className="text-2xl font-bold text-indigo-600">
                    {(sedentaryTime / 3600).toFixed(1)} <span className="text-sm text-gray-400 font-normal">{t.stats.units.hours}</span>
                </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">{t.stats.activeBreaks}</p>
                <p className="text-2xl font-bold text-green-500">
                     {/* Show breaks for today based on chart data */}
                     {weeklyStats[weeklyStats.length - 1]?.activeBreaks || 0}
                     <span className="text-sm text-gray-400 font-normal">{t.stats.units.times}</span>
                </p>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 h-80">
            <h3 className="font-bold text-gray-700 mb-4 text-sm">{t.stats.weeklyTrends}</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="sedentaryHours" fill="#6366f1" radius={[4, 4, 0, 0]} name="Sedentary (h)" barSize={12} />
                    <Bar dataKey="activeBreaks" fill="#22c55e" radius={[4, 4, 0, 0]} name="Breaks" barSize={12} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
    );
  };

  const renderProfile = () => {
    // Dynamic Badges based on stats
    const badges = getBadges(lang, userStats);
    const unlockedBadgesCount = badges.filter(b => b.unlocked).length;

    return (
    <div className="px-4 py-8 min-h-screen bg-gray-50 pb-24">
        {/* Profile Header */}
        <div className="flex items-center space-x-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative">
                {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 uppercase border-2 border-indigo-200">
                        {currentUser?.name.charAt(0) || 'U'}
                    </div>
                )}
                <button 
                  onClick={() => {
                      setEditName(currentUser?.name || '');
                      setEditAvatar(currentUser?.avatar || '');
                      setIsEditingProfile(true);
                  }}
                  className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full shadow-md border-2 border-white hover:bg-indigo-700 active:scale-95 transition-all"
                >
                    <Edit2 size={12} />
                </button>
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">{currentUser?.name || 'User'}</h2>
                <div className="flex items-start mt-1 space-x-1">
                    <QuoteIcon size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-indigo-500 font-medium leading-tight">
                        {lang === 'zh' ? dailyQuote.zh : dailyQuote.en}
                    </p>
                </div>
            </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditingProfile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)} />
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl z-10 p-6 animate-in zoom-in-95">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">{t.profile.editProfile}</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">{t.auth.name}</label>
                            <input 
                                type="text" 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">{t.profile.avatarUrl}</label>
                            <div className="relative">
                                <Camera className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    value={editAvatar}
                                    onChange={(e) => setEditAvatar(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-3 mt-6">
                        <button 
                            onClick={() => setIsEditingProfile(false)}
                            className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl"
                        >
                            {t.common.cancel}
                        </button>
                        <button 
                            onClick={handleUpdateProfile}
                            disabled={isSavingProfile}
                            className="flex-1 py-3 text-white font-bold bg-indigo-600 rounded-xl flex items-center justify-center"
                        >
                            {isSavingProfile ? <Loader2 className="animate-spin" size={20} /> : t.common.save}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="text-center w-1/3 border-r border-gray-100">
                <p className="font-bold text-lg text-indigo-600">{userStats.currentStreak}</p>
                <p className="text-[10px] text-gray-400 uppercase">{t.profile.streak}</p>
            </div>
            <div className="text-center w-1/3 border-r border-gray-100">
                <p className="font-bold text-lg text-green-600">{userStats.totalWorkouts}</p>
                <p className="text-[10px] text-gray-400 uppercase">{t.profile.workouts}</p>
            </div>
            <div className="text-center w-1/3">
                <p className="font-bold text-lg text-yellow-500">{unlockedBadgesCount}</p>
                <p className="text-[10px] text-gray-400 uppercase">{t.profile.badges}</p>
            </div>
        </div>

        <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                <Award className="mr-2 text-yellow-500" size={18} /> {t.profile.achievements}
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {badges.map(badge => (
                    <div key={badge.id} className={`p-3 rounded-lg border flex items-center space-x-3 transition-colors ${badge.unlocked ? 'bg-white border-green-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <div className="text-2xl">{badge.icon}</div>
                        <div>
                            <p className={`font-bold text-sm ${badge.unlocked ? 'text-gray-800' : 'text-gray-500'}`}>{badge.name}</p>
                            <p className="text-[10px] text-gray-500 leading-tight">{badge.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <button 
              onClick={() => setShowDNDManager(true)}
              className="w-full flex justify-between items-center p-4 border-b border-gray-50 active:bg-gray-50"
            >
                <div className="flex items-center">
                    <Moon className="text-indigo-500 mr-3" size={18} />
                    <span className="text-sm font-medium text-gray-700">{t.profile.dndSettings}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
            </button>
            <button 
                onClick={toggleLanguage}
                className="w-full flex justify-between items-center p-4 active:bg-gray-50"
            >
                <div className="flex items-center">
                    <Globe className="text-blue-500 mr-3" size={18} />
                    <span className="text-sm font-medium text-gray-700">{t.profile.language}</span>
                </div>
                <div className="flex items-center">
                    <span className="text-xs text-gray-400 mr-2 font-medium bg-gray-100 px-2 py-1 rounded">
                        {lang === 'en' ? 'English' : '中文'}
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                </div>
            </button>
        </div>

        <button 
            onClick={handleLogout}
            className="w-full py-3 bg-white text-red-500 border border-gray-200 rounded-xl font-bold text-sm shadow-sm active:bg-gray-50 transition-colors flex items-center justify-center"
        >
            <LogOut size={18} className="mr-2" />
            {t.auth.logout}
        </button>
    </div>
    );
  };

  if (!currentUser) {
    return (
      <Auth onLogin={handleLogin} lang={lang} />
    );
  }

  return (
    <div className="font-sans text-gray-900 antialiased selection:bg-indigo-100 selection:text-indigo-700">
      <Announcements 
        isOpen={showAnnouncements}
        onClose={() => setShowAnnouncements(false)}
        lang={lang}
        currentUser={currentUser}
      />
      {activeExercise ? (
        <WorkoutPlayer 
            exercise={activeExercise}
            onClose={() => setActiveExercise(null)}
            onComplete={handleWorkoutComplete}
            lang={lang}
        />
      ) : showDNDManager ? (
        <DNDManager 
          settings={userSettings.doNotDisturb}
          onUpdate={(newDND) => setUserSettings({ ...userSettings, doNotDisturb: newDND })}
          onBack={() => setShowDNDManager(false)}
          lang={lang}
        />
      ) : (
        <>
          {currentView === AppView.HOME && renderHome()}
          {currentView === AppView.WORKOUTS && renderWorkouts()}
          {currentView === AppView.STATS && renderStats()}
          {currentView === AppView.PROFILE && renderProfile()}
          <Navigation currentView={currentView} setView={setCurrentView} lang={lang} />
        </>
      )}
    </div>
  );
};

export default App;
