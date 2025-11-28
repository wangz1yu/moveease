
import React, { useState, useEffect } from 'react';
import { X, Bell, Calendar, Send, Loader2 } from 'lucide-react';
import { Language, Announcement, User } from '../types';
import { TRANSLATIONS } from '../constants';

interface AnnouncementsProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: User | null;
}

const Announcements: React.FC<AnnouncementsProps> = ({ isOpen, onClose, lang, currentUser }) => {
  const t = TRANSLATIONS[lang].announcements;
  const tCommon = TRANSLATIONS[lang].common;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin Post State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Check Admin Privilege (Updated domain)
  useEffect(() => {
    if (currentUser && currentUser.email === 'admin@sitclock.cn') {
        setIsAdmin(true);
    } else {
        setIsAdmin(false);
    }
  }, [currentUser]);

  // Fetch Data
  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
            const data = await res.json();
            setAnnouncements(data);
        }
    } catch (e) {
        console.error("Failed to fetch announcements", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
      if (isOpen) {
          fetchAnnouncements();
      }
  }, [isOpen]);

  const handlePost = async () => {
      if (!newTitle || !newContent) return;
      setIsPosting(true);
      try {
          const res = await fetch('/api/announcements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newTitle, content: newContent })
          });
          if (res.ok) {
              setNewTitle('');
              setNewContent('');
              fetchAnnouncements(); // Refresh list
          }
      } catch (e) {
          alert('Failed to post announcement');
      } finally {
          setIsPosting(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
           <div className="flex items-center space-x-2">
              <Bell size={20} className="fill-white" />
              <h2 className="font-bold text-lg">{t.title}</h2>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Admin Section */}
        {isAdmin && (
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
                <h3 className="text-xs font-bold text-indigo-800 uppercase mb-2">{t.adminTitle}</h3>
                <input 
                    className="w-full mb-2 p-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder={t.titlePh}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                />
                <textarea 
                    className="w-full mb-2 p-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 h-20 resize-none"
                    placeholder={t.contentPh}
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                />
                <button 
                    onClick={handlePost}
                    disabled={isPosting || !newTitle}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isPosting ? <Loader2 className="animate-spin mr-1" size={14}/> : <Send size={14} className="mr-1"/>}
                    {t.postBtn}
                </button>
            </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-0">
            {isLoading ? (
                <div className="p-8 flex justify-center text-gray-400">
                    <Loader2 className="animate-spin" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>{t.empty}</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {announcements.map((ann) => (
                        <div key={ann.id} className="p-5 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-gray-800 text-sm">{ann.title}</h3>
                            </div>
                            <div className="flex items-center text-xs text-gray-400 mb-2">
                                <Calendar size={12} className="mr-1" />
                                {new Date(ann.created_at).toLocaleDateString()}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                {ann.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center flex-shrink-0">
            <button 
                onClick={onClose}
                className="text-indigo-600 font-bold text-sm hover:underline"
            >
                {tCommon.confirm}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Announcements;
