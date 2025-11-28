import React from 'react';
import { PlayCircle, Clock } from 'lucide-react';
import { Exercise, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface WorkoutCardProps {
  exercise: Exercise;
  onPlay: () => void;
  lang: Language;
}

const WorkoutCard: React.FC<WorkoutCardProps> = ({ exercise, onPlay, lang }) => {
  const t = TRANSLATIONS[lang].workouts;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col mb-4">
      <div className="relative h-32 w-full">
        <img 
          src={exercise.imageUrl} 
          alt={exercise.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <Clock size={12} className="mr-1" />
            {t.duration.replace('{s}', exercise.duration.toString())}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
            <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-gray-800">{exercise.name}</h3>
                <span className="text-xs font-semibold uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{exercise.category}</span>
            </div>
            <p className="text-sm text-gray-500 line-clamp-2">{exercise.description}</p>
        </div>
        <button 
            onClick={onPlay}
            className="mt-3 w-full flex items-center justify-center bg-indigo-600 active:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
            <PlayCircle size={16} className="mr-2" />
            {t.startActivity}
        </button>
      </div>
    </div>
  );
};

export default WorkoutCard;