
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Smile, X, Loader2 } from 'lucide-react';
import { Language, LifeLog as LifeLogType, User, MoodType } from '../types';
import { TRANSLATIONS, MOODS } from '../constants';

interface LifeLogProps {
  currentUser: User;
  lang: Language;
}

const LifeLog: React.FC<LifeLogProps> = ({ currentUser, lang }) => {
  const t = TRANSLATIONS[lang].lifelog;
  const commonT = TRANSLATIONS[lang].common;
  
  const [logs, setLogs] = useState<LifeLogType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // New Log State
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentUser.id]);

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
          mood: selectedMood
        })
      });
      if(res.ok) {
        setShowModal(false);
        setContent('');
        setSelectedMood('');
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

  // Calendar Logic: Generate last 30 days grid
  const renderCalendar = () => {
      const days = [];
      const today = new Date();
      // Simple 28-day grid (4 weeks)
      for(let i=27; i>=0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          
          // Find log for this day (prioritize latest)
          const log = logs.find(l => l.created_at.startsWith(dateStr));
          const moodConfig = log ? MOODS[log.mood] : null;

          days.push(
              <div key={i} className="flex flex-col items-center">
                  <div 
                    className="w-8 h-8 rounded-lg mb-1 flex items-center justify-center text-xs shadow-sm transition-transform hover:scale-110"
                    style={{
                        backgroundColor: moodConfig ? moodConfig.color : '#f3f4f6',
                        border: moodConfig ? 'none' : '1px solid #e5e7eb'
                    }}
                    title={dateStr}
                  >
                      {moodConfig?.icon}
                  </div>
                  <span className="text-[10px] text-gray-400">{d.getDate()}</span>
              </div>
          );
      }
      return days;
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

          {/* Pixel Calendar View */}
          <div className="bg-white mt-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last 28 Days</h3>
                  <Calendar size={14} className="text-gray-400"/>
              </div>
              <div className="grid grid-cols-7 gap-3">
                  {renderCalendar()}
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
