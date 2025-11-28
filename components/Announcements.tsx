
import React from 'react';
import { X, Bell, Calendar } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS, MOCK_ANNOUNCEMENTS } from '../constants';

interface AnnouncementsProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const Announcements: React.FC<AnnouncementsProps> = ({ isOpen, onClose, lang }) => {
  const t = TRANSLATIONS[lang].announcements;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
           <div className="flex items-center space-x-2">
              <Bell size={20} className="fill-white" />
              <h2 className="font-bold text-lg">{t.title}</h2>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="p-0 max-h-[70vh] overflow-y-auto no-scrollbar">
            {MOCK_ANNOUNCEMENTS.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>{t.empty}</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {MOCK_ANNOUNCEMENTS.map((ann) => (
                        <div key={ann.id} className="p-5 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                                {ann.isNew && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 flex-shrink-0">NEW</span>
                                )}
                            </div>
                            <div className="flex items-center text-xs text-gray-400 mb-2">
                                <Calendar size={12} className="mr-1" />
                                {ann.date}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                {ann.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
            <button 
                onClick={onClose}
                className="text-indigo-600 font-bold text-sm hover:underline"
            >
                {TRANSLATIONS[lang].common.confirm}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Announcements;
