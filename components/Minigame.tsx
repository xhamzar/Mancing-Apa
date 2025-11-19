
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FishType } from '../types';
import { Sparkles, AlertOctagon, Bot } from 'lucide-react';

interface MinigameProps {
  fish: FishType;
  rodLevel: number;
  enchant: string;
  isAuto?: boolean;
  onEnd: (success: boolean) => void;
}

const Minigame: React.FC<MinigameProps> = ({ fish, rodLevel, enchant, isAuto, onEnd }) => {
  const [progress, setProgress] = useState(30); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [isCatching, setIsCatching] = useState(false);
  
  // --- LATEST PROPS REF PATTERN ---
  // This prevents the game loop from resetting when parent re-renders (e.g. clock updates)
  const propsRef = useRef({ fish, rodLevel, enchant, isAuto, onEnd });
  useEffect(() => {
      propsRef.current = { fish, rodLevel, enchant, isAuto, onEnd };
  }, [fish, rodLevel, enchant, isAuto, onEnd]);

  // Physics & Game State
  const stateRef = useRef({
    playerY: 0, 
    playerVel: 0,
    fishY: 100, 
    fishTargetY: 100,
    fishTimer: 0,
    fishSpeed: 0,
    catchProgress: 30,
    timeLeft: 0,
    holding: false,
    isRunning: true
  });

  const playerBarRef = useRef<HTMLDivElement>(null);
  const fishIconRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const TRACK_HEIGHT = 200;
  const FISH_HEIGHT = 24;
  
  useEffect(() => {
    // --- INITIALIZATION (RUNS ONCE) ---
    const { fish: initFish, enchant: initEnchant } = propsRef.current;
    const difficulty = initFish.difficulty || 1;
    
    // Time limit calculation
    const initTime = Math.max(8.0, 12.0 - difficulty * 0.4 + Math.random() * 2.0);
    
    stateRef.current = {
      playerY: 0, 
      playerVel: 0,
      fishY: TRACK_HEIGHT / 2, 
      fishTargetY: TRACK_HEIGHT / 2,
      fishTimer: 0,
      fishSpeed: 0,
      catchProgress: 30, 
      timeLeft: initTime,
      holding: false,
      isRunning: true
    };

    // --- GAME LOOP ---
    const gameLoop = (time: number) => {
      if (!stateRef.current.isRunning) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.05); // Hard cap delta to prevent jumps
      lastTimeRef.current = time;

      // Get latest props inside loop
      const { fish: currentFish, rodLevel: currentRodLevel, enchant: currentEnchant, isAuto: currentAuto, onEnd: currentOnEnd } = propsRef.current;
      const currentDifficulty = currentFish.difficulty || 1;

      // Calc Bar Height dynamically
      let baseHeight = 65; 
      if (currentEnchant === 'steady') baseHeight = 85;
      const playerBarHeight = Math.max(40, baseHeight - (currentDifficulty * 2));

      const state = stateRef.current;
      state.timeLeft -= deltaTime;
      
      // --- FISH AI ---
      state.fishTimer -= deltaTime * 60;
      if (state.fishTimer <= 0) {
         state.fishTargetY = Math.random() * (TRACK_HEIGHT - FISH_HEIGHT);
         state.fishTimer = 40 + Math.random() * (100 - currentDifficulty * 7);
         state.fishSpeed = 0.5 + (currentDifficulty * 0.25) + Math.random() * 0.4;
      }

      // Move Fish
      const dist = state.fishTargetY - state.fishY;
      const moveStep = state.fishSpeed * deltaTime * 60 * 2;
      
      if (Math.abs(dist) < moveStep) {
          state.fishY = state.fishTargetY;
      } else {
          state.fishY += Math.sign(dist) * moveStep;
      }
      
      state.fishY += Math.sin(time * 0.008) * (1.5 + currentDifficulty * 0.2);
      state.fishY = Math.max(0, Math.min(TRACK_HEIGHT - FISH_HEIGHT, state.fishY));

      // --- PLAYER PHYSICS ---
      if (currentAuto) {
          const targetY = state.fishY - (playerBarHeight / 2) + (FISH_HEIGHT / 2);
          state.playerY = state.playerY + (targetY - state.playerY) * 0.15;
          state.playerVel = 0;
      } else {
          let gravity = 0.9; 
          let boost = 1.5;

          if (currentEnchant === 'steady') {
              gravity = 0.7; 
              boost = 1.2;
          }
          
          boost += (currentRodLevel * 0.05);

          // Physics Step
          if (state.holding) {
            state.playerVel += boost * deltaTime * 60;
          } else {
            state.playerVel -= gravity * deltaTime * 60;
          }

          state.playerVel *= 0.93; // Friction
          state.playerY += state.playerVel * deltaTime * 60;
      }

      // Boundary Bounce
      const maxPlayerY = TRACK_HEIGHT - playerBarHeight;
      if (state.playerY < 0) {
        state.playerY = 0;
        if (!currentAuto) state.playerVel = Math.abs(state.playerVel) * 0.5; 
      } else if (state.playerY > maxPlayerY) {
        state.playerY = maxPlayerY;
        if (!currentAuto) state.playerVel = -Math.abs(state.playerVel) * 0.5;
      }

      // --- COLLISION & PROGRESS ---
      const playerTop = state.playerY + playerBarHeight;
      const fishTop = state.fishY + FISH_HEIGHT;
      
      const isOverlapping = currentAuto || ((state.playerY < fishTop - 4) && (playerTop > state.fishY + 4));
      
      // Progress Calculation
      const catchRate = 25 + (currentRodLevel * 3.0);
      const decayRate = 5 + (currentDifficulty * 1.8);

      if (isOverlapping) {
        state.catchProgress += catchRate * deltaTime;
        setIsCatching(true);
      } else {
        state.catchProgress -= decayRate * deltaTime;
        setIsCatching(false);
      }
      state.catchProgress = Math.max(0, Math.min(100, state.catchProgress));

      // --- RENDER UPDATES ---
      if (playerBarRef.current) {
          playerBarRef.current.style.bottom = `${state.playerY}px`;
          playerBarRef.current.style.height = `${playerBarHeight}px`;
      }

      if (fishIconRef.current) {
          fishIconRef.current.style.bottom = `${state.fishY}px`;
          const tilt = (state.fishTargetY - state.fishY) * 0.5;
          fishIconRef.current.style.transform = `rotate(${-tilt}deg) scaleX(1)`; 
      }

      if (!isOverlapping && state.catchProgress > 0 && containerRef.current) {
          const intensity = Math.min(5, decayRate / 5);
          const x = (Math.random() - 0.5) * intensity;
          const y = (Math.random() - 0.5) * intensity;
          containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
          containerRef.current.style.borderColor = 'rgba(255, 80, 80, 0.6)';
      } else if (containerRef.current) {
          containerRef.current.style.transform = 'none';
          containerRef.current.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      }

      setProgress(state.catchProgress);
      setTimeLeft(state.timeLeft);

      // --- CHECK END CONDITION ---
      if (state.catchProgress >= 100) {
        state.isRunning = false;
        currentOnEnd(true);
      } else if (state.timeLeft <= 0 || state.catchProgress <= 0) {
        state.isRunning = false;
        currentOnEnd(false);
      } else {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    };

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []); // EMPTY DEPENDENCY ARRAY = Runs once on mount, preventing resets!

  // Input Handlers
  const startHold = useCallback(() => { stateRef.current.holding = true; }, []);
  const stopHold = useCallback(() => { stateRef.current.holding = false; }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') startHold(); };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') stopHold(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
    };
  }, [startHold, stopHold]);

  return (
    <div className="absolute inset-0 z-50 select-none">
      {/* Full Screen Tap Zone */}
      {!isAuto && (
        <div 
            className="absolute inset-0 cursor-crosshair touch-none"
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={(e) => { e.preventDefault(); startHold(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopHold(); }}
        />
      )}

      {/* Minigame Panel (Left) */}
      <div 
        ref={containerRef}
        className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center bg-slate-900/90 backdrop-blur-md p-5 rounded-2xl border border-white/30 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors duration-100 pointer-events-none"
      >
         {/* Header */}
         <div className="flex items-center gap-2 mb-2 text-white/90">
             {isAuto ? (
                 <>
                    <Bot size={16} className="text-green-400 animate-bounce" />
                    <span className="font-bold text-xs tracking-wider uppercase text-green-400">AUTO-PILOT</span>
                 </>
             ) : (
                <>
                    {isCatching ? <Sparkles size={16} className="text-yellow-400 animate-spin" /> : <AlertOctagon size={16} className="text-red-400" />}
                    <span className="font-bold text-xs tracking-wider uppercase">
                        {isCatching ? 'REELING!' : 'TENSION!'}
                    </span>
                </>
             )}
         </div>
         
         {/* Track Area */}
         <div className="relative w-[48px] h-[200px] bg-black/80 rounded-xl border-2 border-white/10 overflow-hidden mb-3 shadow-inner ring-1 ring-white/5">
            <div className="absolute inset-0 opacity-20" 
                 style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '100% 20px' }}>
            </div>

            <div 
              ref={fishIconRef}
              className="absolute left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center text-2xl transition-transform duration-75 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10"
            >
              🐟
            </div>

            <div 
              ref={playerBarRef}
              className={`absolute left-1 right-1 rounded-md transition-colors duration-100 border border-white/30 ${isCatching ? 'bg-green-500/80 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-green-600/40'}`}
            >
               <div className="absolute inset-x-1 top-1 bottom-1 border-x border-white/20 rounded-sm"></div>
            </div>
         </div>

         {/* Progress Bar */}
         <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/20 mb-2 relative shadow-inner">
           <div 
             className={`h-full transition-all duration-100 ${progress > 60 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : progress > 30 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' : 'bg-gradient-to-r from-red-600 to-red-500'}`}
             style={{ width: `${progress}%` }}
           />
           <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
         </div>
         
         {/* Timer */}
         <div className={`font-mono font-bold text-xl drop-shadow-md tabular-nums ${timeLeft < 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
           {Math.max(0, timeLeft).toFixed(1)}s
         </div>
         
         {!isAuto && (
             <div className="text-white/40 text-[9px] mt-2 text-center font-medium uppercase tracking-widest">
            Hold Space
            </div>
         )}
      </div>
    </div>
  );
};

export default Minigame;
