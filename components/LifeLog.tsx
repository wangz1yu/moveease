
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, Smile, X, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Clock } from 'lucide-react';
import { Language, LifeLog as LifeLogType, User, MoodType } from '../types';
import { TRANSLATIONS, MOODS } from '../constants';

interface LifeLogProps {
  currentUser: User;
  lang: Language;
}

type ViewMode = 'week' | 'month' | 'year';

const LifeLog: React.FC<LifeLogProps> = ({ currentUser, lang }) => {
  const t = TRANSLATIONS[lang].lifelog;
  const commonT = TRANSLATIONS[lang].common;
  
  const [logs, setLogs] = useState<LifeLogType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Calendar View State
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [referenceDate, setReferenceDate] = useState(new Date());

  // New Log State
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType | ''>('');
  const [entryDate, setEntryDate] = useState(''); // ISO string for input
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentUser.id]);

  // Set default entry date to now when modal opens
  useEffect(() => {
      if (showModal && !entryDate) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          setEntryDate(now.toISOString().slice(0, 16));
      }
  }, [showModal]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lifelogs?userId=${currentUser.id}`);
      if(res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if(!content || !selectedMood) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/lifelogs', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: currentUser.id,
          content,
          mood: selectedMood,
          date: entryDate // Send selected date
        })
      });
      if(res.ok) {
        setShowModal(false);
        setContent('');
        setSelectedMood('');
        // Reset date to null so it re-inits next time
        setEntryDate(''); 
        fetchLogs();
      }
    } catch(e) {
      alert('Failed to save log');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm(commonT.confirm + '?')) return;
      try {
          await fetch(`/api/lifelogs/${id}`, {
              method: 'DELETE',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ userId: currentUser.id })
          });
          setLogs(prev => prev.filter(l => l.id !== id));
      } catch(e) {
          console.error(e);
      }
  };

  // --- CALENDAR LOGIC ---

  const handlePrev = () => {
      const newDate = new Date(referenceDate);
      if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      setReferenceDate(newDate);
  };

  const handleNext = () => {
      const newDate = new Date(referenceDate);
      if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      setReferenceDate(newDate);
  };

  const handleWheel = (e: React.WheelEvent) => {
      // e.deltaY > 0 means scrolling DOWN (Zoom Out)
      // e.deltaY < 0 means scrolling UP (Zoom In)
      if (e.deltaY > 0) {
          if (viewMode === 'week') setViewMode('month');
          else if (viewMode === 'month') setViewMode('year');
      } else {
          if (viewMode === 'year') setViewMode('month');
          else if (viewMode === 'month') setViewMode('week');
      }
  };

  const manualZoomIn = () => {
      if (viewMode === 'year') setViewMode('month');
      else if (viewMode === 'month') setViewMode('week');
  };

  const manualZoomOut = () => {
      if (viewMode === 'week') setViewMode('month');
      else if (viewMode === 'month') setViewMode('year');
  };

  const renderCalendar = () => {
      const items = [];
      const currentYear = referenceDate.getFullYear();
      const currentMonth = referenceDate.getMonth();
      const todayStr = new Date().toISOString().split('T')[0];

      if (viewMode === 'year') {
          // Github Style Contribution Graph
          // Render days for the whole year
          const startOfYear = new Date(currentYear, 0, 1);
          const endOfYear = new Date(currentYear, 11, 31);
          
          for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              const log = logs.find(l => l.created_at.startsWith(dateStr));
              const moodConfig = log ? MOODS[log.mood] : null;

              items.push(
                  <div 
                    key={dateStr}
                    title={`${dateStr} ${moodConfig?.label || ''}`}
                    className="w-2 h-2 rounded-sm"
                    style={{
                        backgroundColor: moodConfig ? moodConfig.color : '#e5e7eb',
                        opacity: moodConfig ? 1 : 0.4
                    }}
                  />
              );
          }
          return (
              <div className="flex flex-wrap gap-1 content-start h-40 overflow-y-auto no-scrollbar justify-center">
                  {items}
              </div>
          );
      } 
      
      if (viewMode === 'month') {
          // Standard Calendar Grid
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          
          for (let i = 1; i <= daysInMonth; i++) {
              const d = new Date(currentYear, currentMonth, i);
              const dateStr = d.toISOString().split('T')[0];
              const log = logs.find(l => l.created_at.startsWith(dateStr));
              const moodConfig = log ? MOODS[log.mood] : null;
              const isToday = dateStr === todayStr;

              items.push(
                  <div key={dateStr} className="flex flex-col items-center">
                      <div 
                        className={`w-8 h-8 rounded-lg mb-1 flex items-center justify-center text-xs shadow-sm transition-transform hover:scale-110 ${isToday ? 'ring-2 ring-indigo-400' : ''}`}
                        style={{
                            backgroundColor: moodConfig ? moodConfig.color : '#f9fafb',
                            border: moodConfig ? 'none' : '1px solid #e5e7eb'
                        }}
                      >
                          {moodConfig?.icon}
                      </div>
                      <span className="text-[10px] text-gray-400">{i}</span>
                  </div>
              );
          }
          return <div className="grid grid-cols-7 gap-3">{items}</div>;
      }

      if (viewMode === 'week') {
          // Detailed Week View
          // Find start of week (Sunday)
          const startOfWeek = new Date(referenceDate);
          startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());

          for (let i = 0; i < 7; i++) {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              const dateStr = d.toISOString().split('T')[0];
              const log = logs.find(l => l.created_at.startsWith(dateStr));
              const moodConfig = log ? MOODS[log.mood] : null;
              const isToday = dateStr === todayStr;

              items.push(
                  <div key={dateStr} className={`flex-1 flex flex-col items-center p-2 rounded-xl border ${isToday ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-white'}`}>
                      <span className="text-xs font-bold text-gray-500 mb-2">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}
                      </span>
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-2 transition-transform hover:scale-110"
                        style={{
                            backgroundColor: moodConfig ? moodConfig.color : '#f3f4f6',
                            border: moodConfig ? 'none' : '1px solid #e5e7eb'
                        }}
                      >
                          {moodConfig?.icon}
                      </div>
                      <span className="text-xs font-bold text-gray-800">{d.getDate()}</span>
                  </div>
              );
          }
          return <div className="flex space-x-2">{items}</div>;
      }
  };

  const getHeaderLabel = () => {
      if (viewMode === 'year') return referenceDate.getFullYear().toString();
      if (viewMode === 'month') return referenceDate.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' });
      // Week range
      const start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - referenceDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - ${end.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-3xl shadow-sm border-b border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                  <p className="text-sm text-gray-500">{t.subtitle}</p>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
              >
                  <Plus size={24} />
              </button>
          </div>

          {/* Interactive Calendar View */}
          <div 
            className="bg-white mt-4 select-none"
            onWheel={handleWheel}
          >
              <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-2">
                      <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={16}/></button>
                      <h3 className="text-sm font-bold text-gray-700 w-32 text-center">{getHeaderLabel()}</h3>
                      <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight size={16}/></button>
                  </div>
                  <div className="flex items-center space-x-1">
                       <button onClick={manualZoomOut} className={`p-1 rounded hover:bg-gray-100 ${viewMode === 'year' ? 'text-gray-300' : 'text-gray-600'}`}><ZoomOut size={16}/></button>
                       <span className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{viewMode}</span>
                       <button onClick={manualZoomIn} className={`p-1 rounded hover:bg-gray-100 ${viewMode === 'week' ? 'text-gray-300' : 'text-gray-600'}`}><ZoomIn size={16}/></button>
                  </div>
              </div>
              
              <div className="min-h-[100px] transition-all duration-300 ease-in-out">
                  {renderCalendar()}
              </div>
              
              <div className="text-center mt-2">
                   <span className="text-[10px] text-gray-300 flex items-center justify-center gap-1">
                       <Calendar size={10} /> 
                       {lang === 'zh' ? '滚动鼠标切换视图' : 'Scroll to zoom'}
                   </span>
              </div>
          </div>
      </div>

      {/* Timeline List */}
      <div className="px-4 py-6">
          <h3 className="text-sm font-bold text-gray-600 mb-4 ml-2">{t.history}</h3>
          
          {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
          ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 mx-2">
                  <Smile size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t.empty}</p>
              </div>
          ) : (
              <div className="space-y-4">
                  {logs.map(log => {
                      const mood = MOODS[log.mood];
                      const date = new Date(log.created_at);
                      return (
                          <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 flex gap-4 animate-in slide-in-from-bottom-2" style={{borderLeftColor: mood.color}}>
                              <div className="flex flex-col items-center justify-center min-w-[3rem]">
                                  <span className="text-2xl">{mood.icon}</span>
                                  <span className="text-[10px] font-bold text-gray-400 mt-1">{date.getHours()}:{date.getMinutes().toString().padStart(2,'0')}</span>
                              </div>
                              <div className="flex-1">
                                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                  <div className="flex justify-between items-center mt-2">
                                      <span className="text-xs text-gray-400">{date.toLocaleDateString()}</span>
                                      <button onClick={() => handleDelete(log.id)} className="text-gray-300 hover:text-red-400">
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

      {/* Input Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)} />
              
              <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{t.newEntry}</h2>
                      <button onClick={() => setShowModal(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                          <X size={20} className="text-gray-500" />
                      </button>
                  </div>

                  {/* Date Picker */}
                  <div className="mb-4">
                       <label className="text-xs font-bold text-gray-500 mb-2 block flex items-center">
                           <Clock size={12} className="mr-1"/> Date & Time
                       </label>
                       <input 
                           type="datetime-local" 
                           value={entryDate}
                           onChange={(e) => setEntryDate(e.target.value)}
                           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                       />
                  </div>

                  <div className="mb-6">
                      <label className="text-xs font-bold text-gray-500 mb-3 block">{t.mood}</label>
                      <div className="flex justify-between px-2">
                          {Object.values(MOODS).map((m) => (
                              <button
                                  key={m.id}
                                  onClick={() => setSelectedMood(m.id)}
                                  className={`flex flex-col items-center transition-all ${selectedMood === m.id ? 'scale-110' : 'opacity-60 grayscale hover:grayscale-0'}`}
                              >
                                  <div 
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm mb-1 transition-colors`}
                                    style={{backgroundColor: selectedMood === m.id ? m.color : '#f3f4f6'}}
                                  >
                                      {m.icon}
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-600">
                                      {t.moods[m.id as keyof typeof t.moods]}
                                  </span>
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="mb-6">
                      <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder={t.placeholder}
                          className="w-full h-32 p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-100 resize-none text-sm leading-relaxed"
                          autoFocus
                      />
                  </div>

                  <button
                      onClick={handleSave}
                      disabled={!content || !selectedMood || isSaving}
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                      {isSaving ? <Loader2 className="animate-spin" /> : commonT.save}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default LifeLog;
