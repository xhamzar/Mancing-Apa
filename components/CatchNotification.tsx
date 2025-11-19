
import React from 'react';
import { FishType } from '../types';
import { FISH_IMAGES } from '../constants';
import { Sparkles } from 'lucide-react';

interface CatchNotificationProps {
  data: { fish: FishType; value: number } | null;
}

const CatchNotification: React.FC<CatchNotificationProps> = ({ data }) => {
  if (!data) return null;

  const { fish, value } = data;
  const rarityLabel = fish.difficulty > 8 ? 'MYTHICAL' : fish.difficulty > 6 ? 'LEGENDARY' : fish.difficulty > 3 ? 'RARE' : 'COMMON';
  
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-[slideDown_0.5s_cubic-bezier(0.25,1,0.5,1)_forwards]">
      <div 
        className="relative flex items-center gap-4 pl-3 pr-6 py-3 bg-slate-900/95 backdrop-blur-xl rounded-r-full rounded-l-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden border border-white/10"
      >
        {/* Glow Effect based on Rarity */}
        <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: `linear-gradient(90deg, ${fish.color} 0%, transparent 100%)` }}
        />
        
        {/* Left Accent Bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: fish.color }} />

        {/* Image Container */}
        <div className="relative w-12 h-12 flex-shrink-0 z-10">
            <div 
                className="absolute inset-0 rounded-full opacity-50 animate-pulse" 
                style={{ backgroundColor: fish.color, filter: 'blur(8px)' }} 
            />
            <div className="w-full h-full rounded-full bg-slate-800 border border-white/20 overflow-hidden relative">
                <img 
                    src={FISH_IMAGES[fish.id] || FISH_IMAGES.common} 
                    alt={fish.name} 
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-900 rounded-full p-0.5 border border-slate-900">
                <Sparkles size={10} strokeWidth={3} />
            </div>
        </div>

        {/* Info */}
        <div className="flex flex-col z-10 min-w-[100px]">
            <div className="flex items-center gap-2">
                <span 
                    className="text-[10px] font-bold tracking-widest uppercase" 
                    style={{ color: fish.color }}
                >
                    {rarityLabel}
                </span>
            </div>
            <span className="text-white font-bold text-lg leading-none drop-shadow-md">
                {fish.name}
            </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10 mx-2 z-10"></div>

        {/* Value */}
        <div className="flex flex-col items-end z-10">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Value</span>
            <span className="text-yellow-400 font-mono font-bold text-xl leading-none">
                +{value}
            </span>
        </div>
      </div>
      
      <style>{`
        @keyframes slideDown {
          0% { transform: translate(-50%, -20px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CatchNotification;
