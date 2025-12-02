
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
import { Play, Pause, RefreshCw, Smartphone, Award, ChevronRight, Zap, Moon, Globe, LogOut, Bell, Edit2, Camera, Loader2, Quote as QuoteIcon, Heart, Star, ThumbsUp, Info, Upload, AlarmClock, X } from 'lucide-react';

const SETTINGS_KEY = 'moveease_settings_v1';
const TIMER_KEY = 'moveease_timer_v1';
const SESSION_KEY = 'moveease_user_session';

// Helper for days
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- About Modal Component ---
const AboutModal = ({ isOpen, onClose, lang }: { isOpen: boolean; onClose: () => void; lang: 'en' | 'zh' }) => {
    if (!isOpen) return null;
    const t = TRANSLATIONS[lang];
    
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl z-10 p-6 animate-in zoom-in-95">
                <div className="flex flex-col items-center mb-4">
                     <img 
                        src="/logo.png" 
                        alt="SitClock" 
                        className="w-[80px] h-[80px] rounded-2xl flex items-center justify-center shadow-lg mb-3 object-cover bg-white"
                     />
                     <h2 className="text-xl font-bold text-gray-900">SitClock</h2>
                     <p className="text-sm text-gray-500">{t.common.version} 1.4.0</p>
                </div>
                <div className="text-sm text-gray-600 space-y-2 text-center mb-6">
                    <p>{lang === 'zh' ? 'SitClock 致力于通过智能提醒和微健身课程，帮助久坐人群改善健康状况。' : 'SitClock is dedicated to helping sedentary people improve their health through smart reminders and micro-fitness courses.'}</p>
                    <p className="text-xs text-gray-400 mt-4">© 2024 SitClock. All rights reserved.</p>
                </div>
                <button 
                    onClick={onClose}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors"
                >
                    {t.common.confirm}
                </button>
            </div>
        </div>
    );
};

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
  const [showAbout, setShowAbout] = useState(false);

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
  const [sedentaryTime, setSedentaryTime] = useState(0); // Current active timer
  const [todayAccumulatedMinutes, setTodayAccumulatedMinutes] = useState(0); // Confirmed/Saved minutes for today
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [showTimerMenu, setShowTimerMenu] = useState(false); // Quick Reminder Menu
  
  // Custom Timer State
  const [customTimerInput, setCustomTimerInput] = useState('');
  const [showCustomTimerInput, setShowCustomTimerInput] = useState(false);
  
  // Quick Timer / Countdown State
  // [NEW] Use End Timestamp for sync
  const [quickTimerEndAt, setQuickTimerEndAt] = useState<number | null>(null);
  const [quickTimerTotalDuration, setQuickTimerTotalDuration] = useState(0);
  const [quickTimerLeft, setQuickTimerLeft] = useState(0);
  
  // Initialize with empty 7 days to avoid chart errors
  const [weeklyStats, setWeeklyStats] = useState<DailyStat[]>(() => {
      const today = new Date();
      return Array.from({length: 7}, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (6 - i));
          return {
              day: DAYS[d.getDay()],
              dateFull: d.toISOString().split('T')[0],
              sedentaryHours: 0,
              activeBreaks: 0
          };
      });
  });
  
  // 3. User Gamification Stats
  const [userStats, setUserStats] = useState<UserStats>({
      totalWorkouts: 0,
      currentStreak: 0,
      lastWorkoutDate: null
  });

  // 4. Daily Quote
  const [dailyQuote, setDailyQuote] = useState<Quote>(INSPIRATIONAL_QUOTES[0]);

  // 5. Celebration State
  const [celebration, setCelebration] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // 6. Workout Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // --- API SYNC FUNCTIONS ---

  // Sync stats to server
  const syncStats = async (stats: UserStats, todaySedentaryMinutes: number, todayBreaks: number) => {
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
                  todaySedentaryMinutes: todaySedentaryMinutes,
                  todayBreaks: todayBreaks
              })
          });
      } catch (e) {
          console.error("Sync failed", e);
      }
  };
  
  // Sync Timer to server
  const syncTimer = async (endAt: number, duration: number) => {
      if (!currentUser) return;
      try {
          await fetch('/api/timer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userId: currentUser.id,
                  endAt: endAt,
                  duration: duration
              })
          });
      } catch (e) {
          console.error("Timer sync failed", e);
      }
  };

  const migrateLegacyStats = async (stats: UserStats, todayMinutes: number, todayBreaks: number) => {
      console.log("Migrating legacy stats to DB...");
      await syncStats(stats, todayMinutes, todayBreaks);
  };

  // Fetch stats from server (With Migration Logic & Profile Sync & Timer Sync)
  const fetchStats = async (userId: string) => {
      try {
          const res = await fetch(`/api/stats?userId=${userId}`);
          if (res.ok) {
              const data = await res.json();
              
              // === Profile Sync Logic ===
              // Detect if avatar/name updated on another device
              if (data.stats.username || data.stats.avatar_url) {
                  const remoteName = data.stats.username;
                  const remoteAvatar = data.stats.avatar_url;
                  
                  if (currentUser && (remoteName !== currentUser.name || remoteAvatar !== currentUser.avatar)) {
                       console.log("Detect profile change, syncing...");
                       const updatedUser = { ...currentUser, name: remoteName, avatar: remoteAvatar };
                       setCurrentUser(updatedUser);
                       localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
                  }
              }

              // === Timer Sync Logic ===
              if (data.stats.timer_end_at > 0) {
                   const serverEndAt = Number(data.stats.timer_end_at);
                   const serverDuration = Number(data.stats.timer_duration);
                   
                   // Only update if significantly different to avoid jitter during countdown
                   // or if local state is null
                   if (quickTimerEndAt !== serverEndAt) {
                       setQuickTimerEndAt(serverEndAt);
                       setQuickTimerTotalDuration(serverDuration);
                       // Immediate calc
                       const now = Date.now();
                       const remaining = Math.max(0, Math.floor((serverEndAt - now) / 1000));
                       setQuickTimerLeft(remaining);
                   }
              } else if (data.stats.timer_end_at === 0 && quickTimerEndAt !== null) {
                  // Timer cleared remotely
                  setQuickTimerEndAt(null);
                  setQuickTimerLeft(0);
              }

              // === Data Migration Logic ===
              if ((!data.stats || data.stats.total_workouts === 0) && userStats.totalWorkouts > 0) {
                   const todayIndex = weeklyStats.length - 1;
                   const todayMinutes = (weeklyStats[todayIndex]?.sedentaryHours || 0) * 60;
                   const todayBreaks = weeklyStats[todayIndex]?.activeBreaks || 0;
                   await migrateLegacyStats(userStats, todayMinutes, todayBreaks);
                   return; 
              }
              // ===========================

              // 1. Set User Stats (Badges/Streak)
              setUserStats({
                  totalWorkouts: data.stats.total_workouts || 0,
                  currentStreak: data.stats.current_streak || 0,
                  lastWorkoutDate: data.stats.last_workout_date ? data.stats.last_workout_date.split('T')[0] : null
              });

              // 2. Set Weekly Stats (Chart)
              const today = new Date();
              const last7Days = Array.from({length: 7}, (_, i) => {
                  const d = new Date(today);
                  d.setDate(d.getDate() - (6 - i));
                  return d.toISOString().split('T')[0]; // YYYY-MM-DD
              });

              // 3. Set Today Accumulated
              // IMPORTANT: Use local date format matching server logic (Asia/Shanghai approx)
              const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
              
              // Check formatted date string from server or construct local match
              const todayRecord = data.activity.find((a: any) => 
                  (a.activity_date_str && a.activity_date_str === todayStr) || 
                  (a.activity_date && a.activity_date.startsWith(todayStr))
              );
              
              if (todayRecord) {
                  setTodayAccumulatedMinutes(todayRecord.sedentary_minutes);
              } else {
                  setTodayAccumulatedMinutes(0);
              }

              const chartData = last7Days.map(dateStr => {
                  const dayRecord = data.activity.find((a: any) => 
                      (a.activity_date_str && a.activity_date_str === dateStr) || 
                      (a.activity_date && a.activity_date.startsWith(dateStr))
                  );
                  return {
                      day: DAYS[new Date(dateStr).getDay()], 
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

  // --- EFFECTS ---

  // Load User Data
  useEffect(() => {
    if (!currentUser) return;

    // A. Load Settings
    const savedSettings = localStorage.getItem(getUserKey(SETTINGS_KEY));
    if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings));
    }

    // B. Load Timer
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

  }, [currentUser?.id]); // Only re-run if ID changes, ignore object ref changes from profile sync
  
  // --- AUTO-SYNC / POLLING ---
  useEffect(() => {
    if (!currentUser) return;

    const sync = () => {
        // Only fetch if tab is active to save bandwidth/battery
        if (document.visibilityState === 'visible') {
            fetchStats(currentUser.id);
        }
    };

    // 1. Sync when tab becomes visible
    document.addEventListener('visibilitychange', sync);

    // 2. Poll every 30 seconds
    const intervalId = setInterval(sync, 30000);

    return () => {
        document.removeEventListener('visibilitychange', sync);
        clearInterval(intervalId);
    };
  }, [currentUser?.id]);

  // Persist Settings
  useEffect(() => {
    if (currentUser) {
        localStorage.setItem(getUserKey(SETTINGS_KEY), JSON.stringify(userSettings));
    }
  }, [userSettings, currentUser?.id]);

  const lang = userSettings.language;
  const t = TRANSLATIONS[lang];

  // UI State
  const [showDNDManager, setShowDNDManager] = useState(false);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState(''); // Stores URL
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores file for upload
  const [previewUrl, setPreviewUrl] = useState(''); // Stores preview blob
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

  // Main Timer Logic (Sedentary Monitor - Count UP)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isMonitoring && !isDNDActive && !activeExercise && currentUser) {
      interval = setInterval(() => {
        setSedentaryTime((prev: number) => {
          const newValue = prev + 1;
          localStorage.setItem(getUserKey(TIMER_KEY), JSON.stringify({
            time: newValue,
            monitoring: true,
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
  }, [isMonitoring, isDNDActive, activeExercise, sedentaryTime, currentUser?.id]);

  // Quick Timer Logic (Count DOWN with Sync)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // Check if we have an active timer synced from server
    if (quickTimerEndAt && !isDNDActive && !activeExercise) {
        interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((quickTimerEndAt - now) / 1000));
            
            setQuickTimerLeft(remaining);

            if (remaining <= 0) {
                // Timer Finished
                clearInterval(interval);
                setCelebration({ show: true, message: t.home.timerFinished });
                setTimeout(() => setCelebration({ show: false, message: '' }), 3000);
                
                // Reset State & Sync Clear to DB
                setQuickTimerEndAt(null);
                setQuickTimerTotalDuration(0);
                setQuickTimerLeft(0);
                syncTimer(0, 0); // Clear timer on server
            }
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [quickTimerEndAt, isDNDActive, activeExercise]);

  // Combined logic to reset timer AND save data (fix disappearing bug)
  const resetTimer = (incrementBreak = false) => {
    if (!currentUser) return;

    // 1. Calculate new totals
    const currentMinutes = Math.floor(sedentaryTime / 60);
    const newAccumulatedMinutes = todayAccumulatedMinutes + currentMinutes;

    // 2. Update local state immediately (so UI doesn't jump)
    setTodayAccumulatedMinutes(newAccumulatedMinutes);

    // 3. Update break count
    const totalBreaksToday = (weeklyStats[weeklyStats.length - 1]?.activeBreaks || 0) + (incrementBreak ? 1 : 0);

    // 4. Sync to DB
    syncStats(userStats, newAccumulatedMinutes, totalBreaksToday);

    // 5. Update WeeklyStats (Local cache for Chart)
    const newWeeklyStats = [...weeklyStats];
    const todayIndex = newWeeklyStats.length - 1;
    if (newWeeklyStats[todayIndex]) {
        newWeeklyStats[todayIndex].activeBreaks = totalBreaksToday;
        newWeeklyStats[todayIndex].sedentaryHours = Number((newAccumulatedMinutes / 60).toFixed(1));
    }
    setWeeklyStats(newWeeklyStats);

    // 6. Reset current timer
    setSedentaryTime(0);
    setAlertLevel(0);
    localStorage.setItem(getUserKey(TIMER_KEY), JSON.stringify({
        time: 0,
        monitoring: isMonitoring
    }));
  };

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

      // Save Data with incremented break
      resetTimer(true);
  };

  const handleMoved = () => {
      // 1. Trigger Animation
      const messages = TRANSLATIONS[lang].feedback || ['Great!', 'Good Job!'];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setCelebration({ show: true, message: randomMsg });

      // 2. Reset Timer
      resetTimer(false);

      // 3. Clear Animation after delay
      setTimeout(() => {
          setCelebration({ show: false, message: '' });
      }, 2500);
  };

  const handleGenerateWorkout = async () => {
    setIsGenerating(true);
    try {
        // [FIX] Ensure the AI uses the currently selected category, default to neck
        const targetCategory = (selectedCategory === 'all' ? 'neck' : selectedCategory) as Exercise['category'];
        
        const newPlan = await generateSmartWorkout(targetCategory, lang);
        
        // [FIX] Force the generated exercises to match the selected category (or target) 
        // to prevent them being hidden by the filter
        const fixedPlan = newPlan.map(ex => ({
            ...ex,
            category: targetCategory // Override category from AI just in case
        }));
        
        setExercises(fixedPlan);
        
        if (selectedCategory === 'all') {
            setSelectedCategory(targetCategory);
        }

    } catch (e) {
        console.error("Plan generation failed", e);
        alert(lang === 'zh' ? '生成失败，请重试' : 'Generation failed, please try again.');
    } finally {
        setIsGenerating(false);
    }
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
    // Reset stats locally
    setWeeklyStats([]);
    setTodayAccumulatedMinutes(0);
    setUserStats({ totalWorkouts: 0, currentStreak: 0, lastWorkoutDate: null });
    setQuickTimerEndAt(null);
    setQuickTimerLeft(0);
  };

  // --- Profile Update with Image Upload ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
      }
  };

  const handleUpdateProfile = async () => {
      if (!currentUser) return;
      setIsSavingProfile(true);
      
      let finalAvatarUrl = editAvatar;

      try {
          // 1. Upload Image if selected
          if (selectedFile) {
              const formData = new FormData();
              formData.append('avatar', selectedFile);
              
              const uploadRes = await fetch('/api/upload-avatar', {
                  method: 'POST',
                  body: formData
              });
              
              if (uploadRes.ok) {
                  const data = await uploadRes.json();
                  finalAvatarUrl = data.url;
              } else {
                  console.error('Image upload failed');
              }
          }

          // 2. Update Profile
          const response = await fetch('/api/update-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: currentUser.id,
                  name: editName,
                  avatar: finalAvatarUrl
              })
          });
          
          if (!response.ok) throw new Error('Failed to update');
          
          const updatedUser = { ...currentUser, name: editName, avatar: finalAvatarUrl };
          setCurrentUser(updatedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
          
          // Cleanup
          if (previewUrl) URL.revokeObjectURL(previewUrl);
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
    if (isDNDActive) return 'url(#gradientDND)'; 
    if (!isMonitoring) return '#D1D5DB';
    // Use gradient IDs
    if (sedentaryTime < threshold * 0.5) return 'url(#gradientGreen)';
    if (sedentaryTime < threshold * 0.9) return 'url(#gradientYellow)';
    return 'url(#gradientRed)';
  };

  // --- VIEWS ---

  const renderHome = () => {
    // 1. Inner Ring (Sedentary Monitor) Logic
    const progress = Math.min((sedentaryTime / threshold) * 100, 100);
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    // 2. Outer Ring (Quick Timer) Logic
    const isQuickTimerActive = quickTimerLeft > 0;
    const radiusOuter = 120;
    const circumferenceOuter = 2 * Math.PI * radiusOuter;
    
    // Drain progress based on synced Duration and Left time
    const drainProgress = quickTimerTotalDuration > 0 ? (quickTimerLeft / quickTimerTotalDuration) * 100 : 0;
    const offsetDrain = circumferenceOuter - (drainProgress / 100) * circumferenceOuter;

    return (
      <div className="flex flex-col items-center pt-8 px-6 min-h-screen bg-gray-50 relative overflow-hidden">
        
        {/* CSS Animation for Floating Particles */}
        <style>{`
          @keyframes floatUp {
            0% { transform: translateY(0) scale(0.5); opacity: 1; }
            100% { transform: translateY(-150px) scale(1.2); opacity: 0; }
          }
          .animate-float {
             animation: floatUp 1.5s ease-out forwards;
          }
        `}</style>

        {/* Celebration Particles */}
        {celebration.show && (
            <div className="absolute inset-0 z-30 pointer-events-none">
                {/* Randomly generated particles */}
                {Array.from({ length: 12 }).map((_, i) => {
                    const icons = [Heart, Star, ThumbsUp, Zap];
                    const Icon = icons[i % icons.length];
                    const left = `${10 + Math.random() * 80}%`;
                    const delay = `${Math.random() * 0.5}s`;
                    const color = ['text-red-500', 'text-yellow-500', 'text-blue-500', 'text-purple-500'][i % 4];
                    const size = 20 + Math.random() * 20;

                    return (
                        <div 
                            key={i} 
                            className={`absolute bottom-32 ${color} animate-float`}
                            style={{ left, animationDelay: delay }}
                        >
                            <Icon size={size} fill="currentColor" className="opacity-80" />
                        </div>
                    );
                })}
                
                {/* Central Feedback Toast */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-xs px-4">
                    <div className="bg-white/90 backdrop-blur-md border-2 border-indigo-100 shadow-2xl rounded-2xl p-6 text-center animate-in zoom-in-50 duration-300">
                        <span className="text-4xl mb-2 block">✨</span>
                        <h2 className="text-2xl font-bold text-indigo-600 bg-clip-text">
                            {celebration.message}
                        </h2>
                    </div>
                </div>
            </div>
        )}

        <header className="w-full flex justify-between items-center mb-6 relative z-20">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">SitClock</h1>
                <p className="text-sm text-gray-500">
                    {isDNDActive ? t.home.paused : t.home.tracking}
                </p>
            </div>
            <div className="flex items-center space-x-3">
                {/* Quick Timer Button */}
                <button 
                  onClick={() => { setShowTimerMenu(!showTimerMenu); setShowCustomTimerInput(false); }}
                  className={`p-2 rounded-full shadow-sm border hover:text-indigo-600 active:scale-95 transition-all relative ${isQuickTimerActive ? 'bg-red-50 text-red-500 border-red-200 animate-pulse' : 'bg-white text-gray-500 border-gray-100'}`}
                >
                    <AlarmClock size={20} />
                </button>
                {/* Announcements Button */}
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

            {/* Quick Timer Menu */}
            {showTimerMenu && (
                <div className="absolute top-14 right-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-48 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">{t.home.setReminder}</span>
                        <button onClick={() => { setShowTimerMenu(false); setShowCustomTimerInput(false); }}><X size={14} className="text-gray-400"/></button>
                    </div>
                    {showCustomTimerInput ? (
                         <div className="px-2 pb-2">
                             <input 
                                 type="number" 
                                 value={customTimerInput}
                                 onChange={(e) => setCustomTimerInput(e.target.value)}
                                 placeholder={t.home.enterMinutes}
                                 className="w-full mb-2 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                 autoFocus
                             />
                             <button
                                 onClick={() => {
                                     const min = parseInt(customTimerInput);
                                     if (min > 0) {
                                          const durationSec = min * 60;
                                          const endAt = Date.now() + (durationSec * 1000);
                                          setQuickTimerEndAt(endAt);
                                          setQuickTimerTotalDuration(durationSec);
                                          setQuickTimerLeft(durationSec);
                                          syncTimer(endAt, durationSec);
                                          setShowTimerMenu(false);
                                          setShowCustomTimerInput(false);
                                          setCustomTimerInput('');
                                     }
                                 }}
                                 className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold mb-2 hover:bg-indigo-700"
                             >
                                 {t.home.start}
                             </button>
                             <button
                                 onClick={() => setShowCustomTimerInput(false)}
                                 className="w-full text-gray-500 text-xs hover:underline"
                             >
                                 {t.common.back}
                             </button>
                         </div>
                    ) : (
                        <>
                            {[30, 45, 60, 90].map(min => (
                                <button
                                    key={min}
                                    onClick={() => {
                                        const durationSec = min * 60;
                                        const endAt = Date.now() + (durationSec * 1000);
                                        setQuickTimerEndAt(endAt);
                                        setQuickTimerTotalDuration(durationSec);
                                        setQuickTimerLeft(durationSec);
                                        syncTimer(endAt, durationSec); // Sync to server
                                        setShowTimerMenu(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                                >
                                    {min} min
                                </button>
                            ))}
                            <button
                                onClick={() => setShowCustomTimerInput(true)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50"
                            >
                                {t.home.custom}
                            </button>
                            <button
                                onClick={() => {
                                    setQuickTimerEndAt(null);
                                    setQuickTimerTotalDuration(0);
                                    setQuickTimerLeft(0);
                                    syncTimer(0, 0); // Clear on server
                                    setShowTimerMenu(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-red-500 hover:bg-red-50"
                            >
                                {t.common.cancel}
                            </button>
                        </>
                    )}
                </div>
            )}
        </header>

        {/* Dual Circular Timer */}
        <div className="relative mb-6 z-10 w-72 h-72 flex items-center justify-center">
            {/* Added scale-x-[-1] for reversal effect */}
            <svg className="absolute inset-0 transform -rotate-90 scale-x-[-1] w-full h-full" viewBox="0 0 300 300">
                <defs>
                    <linearGradient id="gradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                    <linearGradient id="gradientYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                    <linearGradient id="gradientRed" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f87171" />
                        <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                     <linearGradient id="gradientDND" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c7d2fe" />
                        <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                </defs>

                {/* OUTER RING (Quick Timer) - Only visible if active */}
                {isQuickTimerActive && (
                    <>
                        <circle
                            cx="150"
                            cy="150"
                            r={radiusOuter}
                            stroke="#fee2e2" 
                            strokeWidth="8"
                            fill="transparent"
                        />
                        <circle
                            cx="150"
                            cy="150"
                            r={radiusOuter}
                            stroke="#ef4444" 
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={circumferenceOuter}
                            strokeDashoffset={offsetDrain}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                        />
                    </>
                )}

                {/* INNER RING (Sedentary Monitor) */}
                <circle
                    cx="150"
                    cy="150"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-gray-100"
                />
                <circle
                    cx="150"
                    cy="150"
                    r={radius}
                    stroke={getProgressColor()}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>

            {/* Center Content */}
            <div className="absolute flex flex-col items-center justify-center text-center z-20">
                {isDNDActive ? (
                   <Moon size={48} className="text-indigo-300 mx-auto mb-2" />
                ) : (
                   <>
                       <div className="text-5xl font-bold text-gray-800 font-mono tracking-tighter">
                           {formatTime(sedentaryTime)}
                       </div>
                       
                       {/* Secondary Timer Display (Countdown) */}
                       {isQuickTimerActive && (
                           <div className="flex items-center text-red-500 font-bold mt-1 animate-pulse">
                               <Bell size={14} className="mr-1" />
                               <span className="font-mono text-lg">-{formatTime(quickTimerLeft)}</span>
                           </div>
                       )}

                       <div className={`text-sm mt-1 font-medium flex items-center justify-center ${isQuickTimerActive ? 'text-red-400 opacity-80' : 'text-gray-500'}`}>
                            {isQuickTimerActive ? t.home.quickTimer : t.home.sedentaryTime}
                            {!isDNDActive && !isQuickTimerActive && <RefreshCw size={12} className="ml-1 opacity-50" />}
                       </div>
                   </>
                )}
            </div>
        </div>
        
        {/* Status Indicator Area */}
        {isDNDActive ? (
            <div className="w-full max-w-xs mb-8 bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col items-center justify-center text-center animate-pulse z-10">
                <div className="flex items-center text-indigo-800 font-bold mb-1">
                    <span className="text-lg mr-2">{t.home.dndActive}</span>
                </div>
                <div className="bg-white/60 px-3 py-1 rounded-full text-sm font-semibold text-indigo-700 border border-indigo-100 mt-2">
                    {activeDNDLabel}
                </div>
                <p className="text-xs text-indigo-400 mt-2">{t.home.autoPaused}</p>
            </div>
        ) : (
            <div className="flex space-x-4 w-full max-w-xs mb-8 z-10">
                <button 
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    className={`flex-1 py-4 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm transition-transform active:scale-95 ${isMonitoring ? 'bg-white text-gray-700 border border-gray-200' : 'bg-indigo-600 text-white'}`}
                >
                    {isMonitoring ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                    {isMonitoring ? t.home.pause : t.home.resume}
                </button>
                <button 
                    onClick={handleMoved}
                    className="flex-1 bg-white border border-gray-200 text-indigo-600 py-4 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm active:bg-indigo-50 transition-colors"
                >
                    <RefreshCw className="mr-2" />
                    {t.home.moved}
                </button>
            </div>
        )}

        {/* Alert Card */}
        {alertLevel > 0 && !isDNDActive && (
             <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-start animate-pulse z-10">
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

  const renderWorkouts = () => {
    // Filter Categories
    const categories = [
        { id: 'all', label: t.workouts.categories.all },
        { id: 'neck', label: t.workouts.categories.neck },
        { id: 'waist', label: t.workouts.categories.waist },
        { id: 'shoulders', label: t.workouts.categories.shoulders },
        { id: 'eyes', label: t.workouts.categories.eyes },
        { id: 'fullbody', label: t.workouts.categories.fullbody },
    ];

    const filteredExercises = selectedCategory === 'all' 
        ? exercises 
        : exercises.filter(ex => ex.category === selectedCategory);

    return (
    <div className="px-4 py-8 min-h-screen bg-gray-50 pb-24">
       <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.workouts.title}</h2>
       
       {/* Category Filters (Scrollable) */}
       <div className="flex overflow-x-auto no-scrollbar space-x-2 mb-6 pb-2 -mx-4 px-4">
           {categories.map(cat => (
               <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-100 shadow-sm'}`}
               >
                   {cat.label}
               </button>
           ))}
       </div>

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
            {filteredExercises.length > 0 ? filteredExercises.map((ex) => (
                <WorkoutCard 
                    key={ex.id} 
                    exercise={ex}
                    lang={lang}
                    onPlay={() => setActiveExercise(ex)} 
                />
            )) : (
                <p className="text-gray-400 text-center text-sm py-4">No exercises found for this category.</p>
            )}
       </div>
    </div>
    );
  };

  const renderStats = () => {
    // Calculate totals
    const currentSessionMinutes = Math.floor(sedentaryTime / 60);
    const totalTodayMinutes = todayAccumulatedMinutes + currentSessionMinutes;
    const totalTodayHours = Number((totalTodayMinutes / 60).toFixed(1));

    // Health Budget Logic (8 hours = 480 mins)
    const limitMinutes = 8 * 60;
    const percentUsed = Math.min((totalTodayMinutes / limitMinutes) * 100, 100);
    const remainingMinutes = Math.max(0, limitMinutes - totalTodayMinutes);
    const remainingHours = (remainingMinutes / 60).toFixed(1);
    
    let progressColor = 'bg-green-500';
    if (percentUsed > 75) progressColor = 'bg-yellow-500';
    if (percentUsed > 95) progressColor = 'bg-red-500';

    // Merge for Chart
    const chartData = [...weeklyStats];
    const todayIndex = chartData.length - 1;
    if (chartData[todayIndex]) {
        chartData[todayIndex] = {
            ...chartData[todayIndex],
            sedentaryHours: totalTodayHours
        };
    }

    return (
    <div className="px-4 py-8 min-h-screen bg-gray-50 pb-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.stats.title}</h2>

        {/* Health Budget Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800 flex items-center">
                    <Heart className="text-red-500 mr-2" size={18} fill="currentColor"/>
                    {t.stats.healthBudget}
                </h3>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    {t.stats.remaining}: {remainingHours} {t.stats.units.hours}
                </span>
            </div>
            
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
                <div 
                    className={`h-full ${progressColor} transition-all duration-1000 ease-out`}
                    style={{ width: `${percentUsed}%` }}
                />
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed">
                {t.stats.medicalAdvice}
            </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">{t.stats.todaySedentary}</p>
                <p className="text-2xl font-bold text-indigo-600">
                    {totalTodayHours} <span className="text-sm text-gray-400 font-normal">{t.stats.units.hours}</span>
                </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-500 text-xs uppercase font-bold mb-1">{t.stats.activeBreaks}</p>
                <p className="text-2xl font-bold text-green-500">
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
    const currentSessionMinutes = Math.floor(sedentaryTime / 60);
    const totalTodayMinutes = todayAccumulatedMinutes + currentSessionMinutes;
    const badges = getBadges(lang, userStats, totalTodayMinutes);
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
                      setSelectedFile(null);
                      setPreviewUrl('');
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
                            
                            {/* Image Preview */}
                            <div className="flex items-center space-x-4 mb-2">
                                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                    {previewUrl || editAvatar ? (
                                        <img src={previewUrl || editAvatar} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Camera size={24} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="flex items-center justify-center w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-colors">
                                        <Upload size={14} className="mr-2" />
                                        {t.common.upload}
                                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={editAvatar}
                                    onChange={(e) => setEditAvatar(e.target.value)}
                                    placeholder="https://... (or upload)"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none text-sm text-gray-500"
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
                className="w-full flex justify-between items-center p-4 border-b border-gray-50 active:bg-gray-50"
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
            <button 
                onClick={() => setShowAbout(true)}
                className="w-full flex justify-between items-center p-4 active:bg-gray-50"
            >
                <div className="flex items-center">
                    <Info className="text-gray-500 mr-3" size={18} />
                    <span className="text-sm font-medium text-gray-700">{t.common.about}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
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
      <AboutModal 
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
        lang={lang}
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
