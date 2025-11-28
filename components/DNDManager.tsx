import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Moon, Calendar, BrainCircuit, Clock, X, Check } from 'lucide-react';
import { DNDSchedule, DNDSettings, Language } from '../types';
import { TRANSLATIONS } from '../constants';

// --- Custom Time Picker Component ---
interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: Language;
}

const TimePicker: React.FC<TimePickerProps> = ({ label, value, onChange, lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);

  const t = TRANSLATIONS[lang];

  // Scroll refs to auto-scroll to selected value
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      setSelectedHour(h || 0);
      setSelectedMinute(m || 0);
    }
  }, [value, isOpen]);

  // Auto-scroll logic when modal opens
  useEffect(() => {
    if (isOpen && hourRef.current && minuteRef.current) {
        // Simple timeout to allow render
        setTimeout(() => {
            const hEl = hourRef.current?.children[selectedHour] as HTMLElement;
            const mIndex = Math.floor(selectedMinute / 5);
            const mEl = minuteRef.current?.children[mIndex] as HTMLElement;
            
            if (hEl) hEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            if (mEl) mEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 100);
    }
  }, [isOpen]);

  const handleSave = () => {
    const formattedHour = selectedHour.toString().padStart(2, '0');
    const formattedMinute = selectedMinute.toString().padStart(2, '0');
    onChange(`${formattedHour}:${formattedMinute}`);
    setIsOpen(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  // 5 minute intervals for simplified mobile UX
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); 

  return (
    <div className="flex-1">
      <label className="text-xs text-gray-500 block mb-1 font-medium">{label}</label>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 text-left flex justify-between items-center active:bg-gray-100 transition-colors"
      >
        <span>{value || '--:--'}</span>
        <Clock size={16} className="text-gray-400" />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
          
          {/* Picker Content */}
          <div className="relative bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <span className="text-lg font-bold text-gray-800">{t.dnd.setLabel.replace('{label}', label)}</span>
              <button onClick={() => setIsOpen(false)} className="p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="flex h-48 mb-6 relative bg-gray-50 rounded-xl overflow-hidden">
               {/* Selection Highlight Bar (Center) */}
               <div className="absolute top-1/2 left-4 right-4 h-10 -mt-5 bg-indigo-100/50 rounded-lg border border-indigo-200 pointer-events-none z-0" />

               {/* Hours Column */}
               <div ref={hourRef} className="flex-1 overflow-y-auto no-scrollbar text-center z-10 py-[76px] scroll-smooth">
                  {hours.map(h => (
                    <div 
                      key={h}
                      onClick={() => setSelectedHour(h)}
                      className={`h-10 flex items-center justify-center text-xl cursor-pointer transition-colors ${selectedHour === h ? 'font-bold text-indigo-700 scale-110' : 'text-gray-400'}`}
                    >
                      {h.toString().padStart(2, '0')}
                    </div>
                  ))}
               </div>
               
               {/* Separator */}
               <div className="w-8 flex items-center justify-center font-bold text-gray-300 z-10 text-xl">:</div>

               {/* Minutes Column */}
               <div ref={minuteRef} className="flex-1 overflow-y-auto no-scrollbar text-center z-10 py-[76px] scroll-smooth">
                  {minutes.map(m => (
                    <div 
                      key={m}
                      onClick={() => setSelectedMinute(m)}
                      className={`h-10 flex items-center justify-center text-xl cursor-pointer transition-colors ${selectedMinute === m ? 'font-bold text-indigo-700 scale-110' : 'text-gray-400'}`}
                    >
                      {m.toString().padStart(2, '0')}
                    </div>
                  ))}
               </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform"
            >
              <Check className="mr-2" size={20} /> {t.common.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Manager Component ---

interface DNDManagerProps {
  settings: DNDSettings;
  onUpdate: (newSettings: DNDSettings) => void;
  onBack: () => void;
  lang: Language;
}

const DNDManager: React.FC<DNDManagerProps> = ({ settings, onUpdate, onBack, lang }) => {
  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const t = TRANSLATIONS[lang];

  const toggleSchedule = (id: string) => {
    const updated = settings.schedules.map(s => 
      s.id === id ? { ...s, isEnabled: !s.isEnabled } : s
    );
    onUpdate({ ...settings, schedules: updated });
  };

  const deleteSchedule = (id: string) => {
    const updated = settings.schedules.filter(s => s.id !== id);
    onUpdate({ ...settings, schedules: updated });
  };

  const addSchedule = () => {
    if (!newLabel || !newStart || !newEnd) return;
    const newSchedule: DNDSchedule = {
      id: Date.now().toString(),
      label: newLabel,
      startTime: newStart,
      endTime: newEnd,
      isEnabled: true
    };
    onUpdate({ ...settings, schedules: [...settings.schedules, newSchedule] });
    setNewLabel('');
    setNewStart('');
    setNewEnd('');
    setIsAdding(false);
  };

  const toggleFeature = (feature: 'calendarSync' | 'smartDetection') => {
    onUpdate({ ...settings, [feature]: !settings[feature] });
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
      <div className="bg-white sticky top-0 border-b border-gray-200 px-4 py-4 flex items-center shadow-sm z-40">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h2 className="ml-2 text-xl font-bold text-gray-900">{t.dnd.title}</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Smart Features */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.dnd.smartControls}</h3>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Calendar size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">{t.dnd.calendarSync}</p>
                <p className="text-xs text-gray-500">{t.dnd.calendarDesc}</p>
              </div>
            </div>
            <button 
              onClick={() => toggleFeature('calendarSync')}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.calendarSync ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.calendarSync ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <BrainCircuit size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">{t.dnd.smartDetect}</p>
                <p className="text-xs text-gray-500">{t.dnd.smartDetectDesc}</p>
              </div>
            </div>
            <button 
              onClick={() => toggleFeature('smartDetection')}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.smartDetection ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.smartDetection ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Schedules */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t.dnd.schedules}</h3>
            {!isAdding && (
              <button onClick={() => setIsAdding(true)} className="text-sm text-indigo-600 font-bold flex items-center bg-indigo-50 px-3 py-1 rounded-full">
                <Plus size={16} className="mr-1" /> {t.dnd.addNew}
              </button>
            )}
          </div>

          {isAdding && (
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">{t.dnd.label}</label>
                  <input 
                    type="text" 
                    placeholder={t.dnd.labelPlaceholder} 
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <TimePicker 
                    label={t.dnd.startTime} 
                    value={newStart} 
                    onChange={setNewStart}
                    lang={lang}
                  />
                  <TimePicker 
                    label={t.dnd.endTime} 
                    value={newEnd} 
                    onChange={setNewEnd} 
                    lang={lang}
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-2 border-t border-gray-100 pt-3">
                    <button 
                        onClick={() => setIsAdding(false)} 
                        className="px-4 py-2 text-sm text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {t.common.cancel}
                    </button>
                    <button 
                        onClick={addSchedule} 
                        disabled={!newLabel || !newStart || !newEnd}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:bg-indigo-700 transition-colors"
                    >
                        {t.dnd.saveSchedule}
                    </button>
                </div>
              </div>
            </div>
          )}

          {settings.schedules.length === 0 && !isAdding && (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
               <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                 <Moon className="text-gray-400" size={24} />
               </div>
               <p className="text-gray-900 font-medium">{t.dnd.noSchedules}</p>
               <p className="text-gray-500 text-xs mt-1">{t.dnd.noSchedulesDesc}</p>
            </div>
          )}

          {settings.schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${schedule.isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Clock size={20} />
                </div>
                <div className={!schedule.isEnabled ? 'opacity-50' : ''}>
                  <p className="font-bold text-gray-800 text-sm">{schedule.label}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{schedule.startTime} - {schedule.endTime}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => toggleSchedule(schedule.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${schedule.isEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${schedule.isEnabled ? 'left-6' : 'left-1'}`} />
                </button>
                <button onClick={() => deleteSchedule(schedule.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DNDManager;