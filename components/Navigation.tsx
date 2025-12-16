
import React from 'react';
import { Home, Dumbbell, BarChart2, User, BookOpen } from 'lucide-react';
import { AppView, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  lang: Language;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView, lang }) => {
  const t = TRANSLATIONS[lang].nav;

  const navItems = [
    { view: AppView.HOME, icon: Home, label: t.monitor },
    { view: AppView.WORKOUTS, icon: Dumbbell, label: t.workouts },
    { view: AppView.LIFELOG, icon: BookOpen, label: t.lifelog },
    { view: AppView.STATS, icon: BarChart2, label: t.stats },
    { view: AppView.PROFILE, icon: User, label: t.profile },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe pt-2 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-between items-center pb-2">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`flex flex-col items-center space-y-1 w-16 transition-colors duration-200 ${
              currentView === item.view ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <item.icon size={24} strokeWidth={currentView === item.view ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Navigation;
