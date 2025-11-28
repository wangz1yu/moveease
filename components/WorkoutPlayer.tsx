
import React, { useState, useEffect } from 'react';
import { X, Play, Pause, CheckCircle, RotateCcw } from 'lucide-react';
import { Exercise, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface WorkoutPlayerProps {
  exercise: Exercise;
  onClose: () => void;
  onComplete?: () => void;
  lang: Language;
}

const WorkoutPlayer: React.FC<WorkoutPlayerProps> = ({ exercise, onClose, onComplete, lang }) => {
  const t = TRANSLATIONS[lang].player;
  
  const [timeLeft, setTimeLeft] = useState(exercise.duration);
  const [isActive, setIsActive] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsCompleted(true);
      setIsActive(false);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDone = () => {
      if (onComplete) onComplete();
      onClose();
  };

  const progress = ((exercise.duration - timeLeft) / exercise.duration) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <h2 className="text-lg font-bold truncate pr-4">{exercise.name}</h2>
        <button 
          onClick={onClose} 
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        
        {/* Background visual/Image */}
        <div className="absolute inset-0 z-0 opacity-20">
            <img 
                src={exercise.imageUrl} 
                alt={exercise.name} 
                className="w-full h-full object-cover"
            />
        </div>

        {/* Timer Circle */}
        <div className="relative z-10 mb-8">
            <svg className="w-64 h-64 transform -rotate-90">
                <circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-700"
                />
                <circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke={isCompleted ? "#4ade80" : "#818cf8"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 120}
                    strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isCompleted ? (
                    <CheckCircle size={64} className="text-green-400 mb-2" />
                ) : (
                    <span className="text-6xl font-mono font-bold tracking-tighter">
                        {formatTime(timeLeft)}
                    </span>
                )}
                <span className="text-sm font-medium text-gray-400 mt-2">
                    {isCompleted ? t.completed : (isActive ? t.timeRemaining : t.paused)}
                </span>
            </div>
        </div>

        {/* Instructions */}
        <div className="z-10 w-full max-w-md bg-gray-800/80 backdrop-blur-md p-6 rounded-2xl border border-gray-700">
            <p className="text-lg text-center leading-relaxed font-medium">
                {isCompleted ? t.goodJob : exercise.description}
            </p>
        </div>
      </div>

      {/* Controls Footer */}
      <div className="p-8 pb-12 bg-gradient-to-t from-black/80 to-transparent">
        {isCompleted ? (
             <button 
                onClick={handleDone}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-900/50 transition-all active:scale-[0.98]"
            >
                {t.done}
            </button>
        ) : (
            <div className="flex space-x-4">
                <button 
                    onClick={toggleTimer}
                    className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all active:scale-[0.98] ${isActive ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'}`}
                >
                    {isActive ? <Pause className="mr-2" fill="currentColor" /> : <Play className="mr-2" fill="currentColor" />}
                    {isActive ? t.paused : t.resume}
                </button>
                <button 
                    onClick={() => {
                        setTimeLeft(exercise.duration);
                        setIsActive(true);
                    }}
                    className="w-16 bg-gray-700 rounded-xl flex items-center justify-center hover:bg-gray-600 active:scale-95 transition-colors"
                >
                    <RotateCcw size={24} />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutPlayer;
