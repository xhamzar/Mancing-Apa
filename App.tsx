
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ThreeView, { ThreeViewApi } from './components/ThreeView';
import Minigame from './components/Minigame';
import FishViewer from './components/FishViewer';
import CatchNotification from './components/CatchNotification';
import { GameState, GameStatus, InventoryItem, Mission, FishType, WeatherType, BoatType, RodSkinType, ActiveEvent, EventType } from './types';
import { FISH_TYPES, ENCHANT_POOL, FISH_IMAGES, BOAT_SHOP, ROD_SKINS } from './constants';
import { Fish, Coins, ShoppingBag, Backpack, Trophy, Settings, RotateCcw, Camera, Sun, Moon, Cloud, CloudRain, CloudLightning, Anchor, Palette, Download, Eye, Bot, Lock, Unlock, Clock, Zap, Sparkles, TrendingUp, Timer } from 'lucide-react';

const STORAGE_KEY = 'fg_state_react_v3';

// --- Helper Functions ---
const randRange = (min: number, max: number) => Math.random() * (max - min) + min;

const generateMission = (rodLevel: number = 1): Mission => {
  // Filter fish based on rod level capability to prevent impossible missions
  // Level 1: Difficulty 1 (Common) only
  // Level 2+: Difficulty <= Level + 2
  const maxDifficulty = rodLevel === 1 ? 1 : Math.min(10, rodLevel + 2);
  
  const availableFish = FISH_TYPES.filter(f => 
    f.difficulty <= maxDifficulty && 
    // Ensure they can actually reach the fish with current max distance potential
    f.minDistance <= (320 + rodLevel * 40) 
  );

  // Fallback to common if something goes wrong
  const pool = availableFish.length > 0 ? availableFish : [FISH_TYPES[0]];
  const fish = pool[Math.floor(Math.random() * pool.length)];
  
  // Easier requirements for low levels
  const minReq = rodLevel === 1 ? 2 : 3;
  const maxReq = rodLevel === 1 ? 4 : 6;
  const required = Math.floor(randRange(minReq, maxReq));
  
  // Boost reward multiplier for beginners (Level 1-3 get 2x rewards)
  const rewardMultiplier = rodLevel <= 3 ? 2.0 : 1.2;
  const baseVal = fish.base || 20;
  const reward = Math.floor(baseVal * required * rewardMultiplier);

  return {
    fishType: fish.id,
    fishName: fish.name,
    required,
    count: 0,
    reward
  };
};

const formatTime = (time: number) => {
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const INITIAL_STATE: GameState = {
  gold: 250,
  rodLevel: 1,
  maxDistance: 0,
  inventory: [],
  equippedEnchant: 'none',
  bestFish: {},
  // FIXED INITIAL MISSION: Always Goldfish, High Reward to help start
  currentMission: {
    fishType: 'common',
    fishName: 'Goldfish',
    required: 3,
    count: 0,
    reward: 300 
  },
  boatType: 'wooden',
  ownedBoats: ['wooden'],
  rodSkin: 'default',
  ownedSkins: ['default'],
  currentMap: 'default',
  savedEvent: null
};

const EVENTS: {type: EventType, name: string, duration: number}[] = [
    { type: 'GOLD_RUSH', name: 'Gold Rush', duration: 60000 * 2 }, // 2 Mins
    { type: 'LUCKY_WATERS', name: 'Lucky Waters', duration: 60000 * 3 }, // 3 Mins
    { type: 'FEEDING_FRENZY', name: 'Feeding Frenzy', duration: 60000 * 2 }, // 2 Mins
];

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [activePanel, setActivePanel] = useState<'shop' | 'inv' | 'museum' | 'settings' | null>(null);
  const [shopTab, setShopTab] = useState<'gear' | 'boats' | 'skins'>('gear');
  
  // Ephemeral State
  const [currentDistance, setCurrentDistance] = useState(0);
  const [activeFish, setActiveFish] = useState<FishType | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lastCatch, setLastCatch] = useState<{ fish: FishType; value: number } | null>(null);
  
  // Event State
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);

  // Auto Fishing State
  const [isAutoFishing, setIsAutoFishing] = useState(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // Weather State
  const [weather, setWeather] = useState<WeatherType>('CLEAR');
  const [gameTime, setGameTime] = useState(8); // 8 AM

  // 3D Preview State
  const [selectedMuseumFish, setSelectedMuseumFish] = useState<FishType | null>(null);
  
  // Debug State
  const [isDebugUnlocked, setIsDebugUnlocked] = useState(false);
  const [debugPasswordInput, setDebugPasswordInput] = useState('');

  const threeApi = useRef<ThreeViewApi | null>(null);
  const biteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catchNotificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSchedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimerRef = useRef<number>(0); // Used for UI force update

  // --- Persistence ---
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const loaded = JSON.parse(raw);
        const merged = { ...INITIAL_STATE, ...loaded };
        setGameState(merged);
        if (merged.savedEvent && merged.savedEvent.endTime > Date.now()) {
            setActiveEvent(merged.savedEvent);
        } else {
            setGameState(prev => ({ ...prev, savedEvent: null }));
        }
      } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  useEffect(() => {
    setGameState(prev => ({ ...prev, savedEvent: activeEvent }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...gameState, savedEvent: activeEvent }));
  }, [gameState, activeEvent]);

  // --- Event System Scheduler ---
  useEffect(() => {
      const checkEvent = () => {
          eventTimerRef.current = Date.now(); 
          
          if (activeEvent) {
              if (Date.now() > activeEvent.endTime) {
                  setActiveEvent(null);
                  showToast("Event Ended");
              }
          } else {
              if (Math.random() < 0.05) {
                  const template = EVENTS[Math.floor(Math.random() * EVENTS.length)];
                  const newEvent: ActiveEvent = {
                      type: template.type,
                      name: template.name,
                      endTime: Date.now() + template.duration
                  };
                  setActiveEvent(newEvent);
                  showToast(`EVENT STARTED: ${template.name}!`);
              }
          }
      };

      eventSchedulerRef.current = setInterval(checkEvent, 5000); // Check logic every 5s
      const uiInterval = setInterval(() => {
          if (activeEvent) setGameTime(t => t); 
      }, 1000);

      return () => {
          if (eventSchedulerRef.current) clearInterval(eventSchedulerRef.current);
          clearInterval(uiInterval);
      };
  }, [activeEvent]);

  // --- PWA Install Logic ---
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      showToast("Installing Game...");
    }
  };

  // --- Callbacks ---
  const onWeatherUpdate = useCallback((newWeather: WeatherType, time: number) => {
    setWeather(newWeather);
    setGameTime(time);
  }, []);

  // --- Actions ---
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const showCatchNotification = (fish: FishType, value: number) => {
    setLastCatch({ fish, value });
    if (catchNotificationTimer.current) clearTimeout(catchNotificationTimer.current);
    catchNotificationTimer.current = setTimeout(() => {
        setLastCatch(null);
    }, 4000);
  };

  const handleDebugUnlock = () => {
      if (debugPasswordInput === 'urangert1') {
          setIsDebugUnlocked(true);
          showToast("Developer Mode Unlocked");
          setDebugPasswordInput('');
      } else {
          showToast("Wrong Password");
      }
  };

  const castRod = useCallback(() => {
    if (status !== 'idle') return;
    
    const dist = Math.floor(randRange(40, 320 + gameState.rodLevel * 40));
    setCurrentDistance(dist);
    setStatus('casting');
    if(!isAutoFishing) showToast(`Casted ${dist}ft!`);
    
    if (dist > gameState.maxDistance) {
      setGameState(prev => ({ ...prev, maxDistance: dist }));
    }

    if (threeApi.current) threeApi.current.cast(dist);

    setTimeout(() => {
      setStatus('floating');
      scheduleBite(dist);
    }, 900);
  }, [status, gameState.rodLevel, gameState.maxDistance, isAutoFishing, activeEvent]); 

  const scheduleBite = (distance: number) => {
    let delayBase = 4000;
    if (weather === 'RAIN') delayBase = 2500;
    if (weather === 'STORM') delayBase = 1500;
    if (activeEvent?.type === 'FEEDING_FRENZY') delayBase *= 0.5; 

    const delay = randRange(1000, delayBase);
    
    biteTimerRef.current = setTimeout(() => {
      const biteThreshold = 0.2 + (gameState.rodLevel * 0.05);
      const distancePenalty = Math.max(0, (distance - 100) * 0.001);
      
      if (Math.random() < (biteThreshold - distancePenalty)) {
        const isNight = gameTime < 6 || gameTime > 18;
        const timeStr = isNight ? 'NIGHT' : 'DAY';

        const candidates = FISH_TYPES.filter(fish => {
            if (distance < fish.minDistance) return false;
            if (fish.requiredWeather && !fish.requiredWeather.includes(weather)) return false;
            if (fish.requiredTime && fish.requiredTime !== timeStr) return false;
            if (fish.requiredEnchant && !fish.requiredEnchant.includes(gameState.equippedEnchant)) return false;
            return true;
        });

        if (candidates.length === 0) candidates.push(FISH_TYPES[0]); 

        let totalWeight = 0;
        const weightedCandidates = candidates.map(fish => {
            let w = fish.weight;
            if (gameState.equippedEnchant === 'lucky' && fish.difficulty > 3) w *= 1.5; 
            if (gameState.equippedEnchant === 'deep' && fish.minDistance > 150) w *= 1.8;
            if (activeEvent?.type === 'LUCKY_WATERS' && fish.difficulty >= 5) w *= 2.5; 
            totalWeight += w;
            return { ...fish, weight: w };
        });

        let r = Math.random() * totalWeight;
        let chosen = weightedCandidates[0];
        for(const f of weightedCandidates) {
          if (r < f.weight) { chosen = f; break; }
          r -= f.weight;
        }
        
        setActiveFish(chosen);
        setStatus('bite');
        if(!isAutoFishing) showToast("Something's biting!");
        
      } else {
        if(!isAutoFishing) showToast("Nothing bit...");
        setTimeout(() => {
           setStatus('idle');
           if (threeApi.current) threeApi.current.reset();
        }, 1000);
      }
    }, delay);
  };

  const startPull = useCallback(() => {
    if (status === 'bite' && activeFish) {
      setStatus('pulling');
      if (threeApi.current) threeApi.current.setReeling(true);
    } else if (status === 'floating') {
      clearTimeout(biteTimerRef.current!);
      showToast("Pulled too early!");
      setStatus('idle');
      if (threeApi.current) threeApi.current.reset();
    }
  }, [status, activeFish]);

  // Wrap in useCallback to provide a stable reference to Minigame
  const onMinigameEnd = useCallback((success: boolean) => {
    if (threeApi.current) threeApi.current.setReeling(false);

    if (success && activeFish) {
      let value = Math.floor(activeFish.base * (1 + gameState.rodLevel * 0.2) + Math.random() * 20);
      if (activeEvent?.type === 'GOLD_RUSH') value = Math.floor(value * 1.5);

      const newItem: InventoryItem = {
        id: Date.now().toString(),
        type: activeFish.id,
        name: activeFish.name,
        value,
        ts: Date.now()
      };

      setGameState(prev => {
        const newInv = [...prev.inventory, newItem];
        let bestFish = { ...prev.bestFish };
        
        if (!bestFish[activeFish.id] || value > bestFish[activeFish.id].value) {
          bestFish[activeFish.id] = { name: activeFish.name, value };
        }

        let mission = { ...prev.currentMission! };
        let goldReward = 0;
        if (mission.fishType === activeFish.id) {
          mission.count++;
          if (mission.count >= mission.required) {
            goldReward = mission.reward;
            showToast(`Mission Complete! +${goldReward} Gold`);
            // Generate new mission based on CURRENT rod level
            mission = generateMission(prev.rodLevel);
          }
        }

        return {
          ...prev,
          inventory: newInv,
          gold: prev.gold + goldReward,
          bestFish,
          currentMission: mission
        };
      });
      
      if (!isAutoFishing) {
          showCatchNotification(activeFish, value);
      } else {
          showToast(`Caught ${activeFish.name} (+${value}G)`);
      }

    } else {
      showToast("The fish got away...");
    }

    setStatus('idle');
    setActiveFish(null);
    if (threeApi.current) threeApi.current.reset();
  }, [activeFish, gameState.rodLevel, gameState.equippedEnchant, activeEvent, isAutoFishing]);

  // --- Auto Fishing Logic ---
  useEffect(() => {
      if (!isAutoFishing) return;
      let timer: ReturnType<typeof setTimeout>;
      if (status === 'idle') {
          timer = setTimeout(() => castRod(), 1500);
      } else if (status === 'bite') {
          timer = setTimeout(() => startPull(), 400);
      }
      return () => clearTimeout(timer);
  }, [isAutoFishing, status, castRod, startPull]);


  // --- Shop Logic ---
  const upgradeRod = () => {
    const price = 100 + (gameState.rodLevel - 1) * 120;
    if (gameState.gold >= price) {
      setGameState(prev => ({ ...prev, gold: prev.gold - price, rodLevel: prev.rodLevel + 1 }));
      showToast(`Upgraded to Lvl ${gameState.rodLevel + 1}`);
    } else showToast("Not enough gold!");
  };

  const buyGacha = () => {
     if (gameState.gold >= 250) {
       const roll = ENCHANT_POOL[Math.floor(Math.random() * ENCHANT_POOL.length)];
       setGameState(prev => ({ ...prev, gold: prev.gold - 250, equippedEnchant: roll.id }));
       showToast(`Got ${roll.name} Enchant!`);
     } else showToast("Need 250 Gold");
  };

  const buyOrEquipBoat = (boatId: BoatType, price: number) => {
      if (gameState.ownedBoats.includes(boatId)) {
          setGameState(prev => ({ ...prev, boatType: boatId }));
          showToast("Equipped " + boatId);
      } else {
          if (gameState.gold >= price) {
              setGameState(prev => ({
                  ...prev,
                  gold: prev.gold - price,
                  ownedBoats: [...prev.ownedBoats, boatId],
                  boatType: boatId
              }));
              showToast("Bought & Equipped!");
          } else {
              showToast("Not enough gold");
          }
      }
  };

  const buyOrEquipSkin = (skinId: RodSkinType, price: number) => {
    if (gameState.ownedSkins.includes(skinId)) {
        setGameState(prev => ({ ...prev, rodSkin: skinId }));
        showToast("Equipped Skin");
    } else {
        if (gameState.gold >= price) {
            setGameState(prev => ({
                ...prev,
                gold: prev.gold - price,
                ownedSkins: [...prev.ownedSkins, skinId],
                rodSkin: skinId
            }));
            showToast("Purchased Skin!");
        } else {
            showToast("Not enough gold");
        }
    }
  };

  const sellFish = (id: string) => {
    const item = gameState.inventory.find(i => i.id === id);
    if (item) {
      setGameState(prev => ({
        ...prev,
        gold: prev.gold + item.value,
        inventory: prev.inventory.filter(i => i.id !== id)
      }));
    }
  };

  const openFishViewer = (fishTypeId: string) => {
    const fish = FISH_TYPES.find(f => f.id === fishTypeId);
    if (fish) setSelectedMuseumFish(fish);
  };

  const addDebugGold = () => {
      setGameState(prev => ({ ...prev, gold: prev.gold + 1000 }));
      showToast("Added 1000 Debug Gold");
  };

  const getWeatherIcon = () => {
    const isNight = gameTime < 6 || gameTime > 18;
    switch(weather) {
      case 'CLEAR': return isNight ? <Moon size={18} className="text-blue-200" /> : <Sun size={18} className="text-yellow-500" />;
      case 'CLOUDY': return <Cloud size={18} className="text-gray-400" />;
      case 'RAIN': return <CloudRain size={18} className="text-blue-400" />;
      case 'STORM': return <CloudLightning size={18} className="text-purple-500" />;
      default: return <Sun size={18} />;
    }
  };
  
  const getEventIcon = (type: EventType) => {
      switch(type) {
          case 'GOLD_RUSH': return <TrendingUp size={20} className="text-yellow-400" />;
          case 'LUCKY_WATERS': return <Sparkles size={20} className="text-purple-400" />;
          case 'FEEDING_FRENZY': return <Zap size={20} className="text-red-400" />;
      }
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <ThreeView 
        rodLevel={gameState.rodLevel}
        enchant={gameState.equippedEnchant}
        boatType={gameState.boatType}
        rodSkin={gameState.rodSkin}
        map={gameState.currentMap}
        onReady={(api) => threeApi.current = api} 
        onWeatherUpdate={onWeatherUpdate}
      />

      <CatchNotification data={lastCatch} />

      <div className="absolute top-0 left-0 w-full p-4 z-10 pointer-events-none">
         <div className="flex justify-between items-start">
            <div className="glass-panel p-3 rounded-xl flex flex-col gap-1 text-sm shadow-lg pointer-events-auto min-w-[140px]">
               <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-1">
                  <div className="flex items-center gap-1 font-bold text-blue-700 text-xs">
                    <span>{currentDistance.toFixed(0)}ft</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="font-mono text-xs font-bold text-slate-600">{formatTime(gameTime)}</span>
                     {getWeatherIcon()}
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                 <Coins size={16} className="text-yellow-600" />
                 <span className="font-bold">{gameState.gold}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">Lvl {gameState.rodLevel}</span>
                 <span className="text-xs text-gray-600 capitalize truncate max-w-[80px]">{gameState.equippedEnchant}</span>
               </div>
            </div>

            <div className="flex gap-2 pointer-events-auto">
               <button 
                  onClick={() => setIsAutoFishing(!isAutoFishing)} 
                  className={`p-2 rounded-lg shadow hover:scale-105 transition ${isAutoFishing ? 'bg-green-500 text-white animate-pulse' : 'bg-white/90 text-slate-700'}`}
                  title="Auto AFK Mode"
               >
                  <Bot size={20} />
               </button>

               {installPrompt && (
                  <button onClick={handleInstall} className="bg-green-500 text-white p-2 rounded-lg shadow hover:scale-105 transition animate-bounce">
                    <Download size={20} />
                  </button>
               )}
               <button onClick={() => setActivePanel(p => p === 'shop' ? null : 'shop')} className="bg-white/90 p-2 rounded-lg shadow hover:scale-105 transition text-slate-700">
                 <ShoppingBag size={20} />
               </button>
               <button onClick={() => setActivePanel(p => p === 'inv' ? null : 'inv')} className="bg-white/90 p-2 rounded-lg shadow hover:scale-105 transition text-slate-700">
                 <Backpack size={20} />
               </button>
               <button onClick={() => setActivePanel(p => p === 'museum' ? null : 'museum')} className="bg-white/90 p-2 rounded-lg shadow hover:scale-105 transition text-slate-700">
                 <Trophy size={20} />
               </button>
               <button onClick={() => setActivePanel(p => p === 'settings' ? null : 'settings')} className="bg-white/90 p-2 rounded-lg shadow hover:scale-105 transition text-slate-700">
                 <Settings size={20} />
               </button>
            </div>
         </div>
      </div>
      
      <div className="absolute top-24 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
          {activeEvent && (
              <div className="glass-panel p-2 rounded-lg flex items-center gap-3 shadow-xl animate-[slideLeft_0.5s_ease-out]">
                  <div className="bg-slate-800 p-2 rounded-md flex items-center justify-center">
                      {getEventIcon(activeEvent.type)}
                  </div>
                  <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Event Active</span>
                      <span className="text-sm font-bold text-slate-800 leading-none">{activeEvent.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                           <Timer size={10} className="text-slate-500" />
                           <span className="text-xs font-mono text-slate-600">
                               {Math.max(0, Math.ceil((activeEvent.endTime - Date.now()) / 1000))}s
                           </span>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {!isAutoFishing && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-4 pointer-events-auto">
           {status === 'idle' && (
             <button 
               onClick={castRod}
               className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-full font-bold shadow-xl text-lg hover:scale-105 active:scale-95 transition-transform"
             >
               CAST ROD
             </button>
           )}
           {(status === 'floating' || status === 'bite') && (
              <button 
               onClick={startPull}
               className={`px-8 py-3 rounded-full font-bold shadow-xl text-lg hover:scale-105 active:scale-95 transition-transform ${status === 'bite' ? 'bg-red-600 animate-pulse text-white' : 'bg-blue-600 text-white'}`}
              >
               {status === 'bite' ? 'PULL NOW!' : 'REEL IN'}
              </button>
           )}
        </div>
      )}
      
      {isAutoFishing && status !== 'idle' && (
         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
             <div className="bg-black/60 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2">
                 <Bot size={16} className="text-green-400 animate-bounce" />
                 <span className="text-sm font-bold tracking-wider">AUTO FISHING...</span>
             </div>
         </div>
      )}

      {status === 'pulling' && activeFish && (
        <Minigame 
          fish={activeFish} 
          rodLevel={gameState.rodLevel} 
          enchant={gameState.equippedEnchant} 
          isAuto={isAutoFishing}
          onEnd={onMinigameEnd}
        />
      )}

      {selectedMuseumFish && (
        <FishViewer 
          fishType={selectedMuseumFish} 
          onClose={() => setSelectedMuseumFish(null)} 
        />
      )}

      {activePanel && (
        <div className="absolute inset-0 z-30 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActivePanel(null)}>
           <div className="bg-white w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-lg capitalize">{activePanel}</h2>
                <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-800">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {activePanel === 'shop' && (
                   <div className="space-y-4">
                      <div className="flex border-b">
                          <button 
                            className={`flex-1 pb-2 text-sm font-bold ${shopTab === 'gear' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
                            onClick={() => setShopTab('gear')}
                          >
                            Gear
                          </button>
                          <button 
                            className={`flex-1 pb-2 text-sm font-bold ${shopTab === 'skins' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
                            onClick={() => setShopTab('skins')}
                          >
                            Skins
                          </button>
                          <button 
                            className={`flex-1 pb-2 text-sm font-bold ${shopTab === 'boats' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
                            onClick={() => setShopTab('boats')}
                          >
                            Boats
                          </button>
                      </div>

                      {shopTab === 'gear' && (
                        <>
                            <div className="flex justify-between items-center p-3 border rounded-lg bg-blue-50">
                                <div>
                                <div className="font-bold">Upgrade Rod</div>
                                <div className="text-xs text-gray-500">Level {gameState.rodLevel} → {gameState.rodLevel + 1}</div>
                                </div>
                                <button onClick={upgradeRod} className="bg-green-500 text-white px-3 py-1.5 rounded text-sm font-bold">
                                {100 + (gameState.rodLevel - 1) * 120} G
                                </button>
                            </div>
                            <div className="flex justify-between items-center p-3 border rounded-lg bg-purple-50">
                                <div>
                                <div className="font-bold">Gacha Enchant</div>
                                <div className="text-xs text-gray-500">Random effect</div>
                                </div>
                                <button onClick={buyGacha} className="bg-purple-500 text-white px-3 py-1.5 rounded text-sm font-bold">
                                250 G
                                </button>
                            </div>
                        </>
                      )}

                      {shopTab === 'skins' && (
                          <div className="space-y-3">
                             {ROD_SKINS.map(skin => {
                                 const owned = gameState.ownedSkins.includes(skin.id as RodSkinType);
                                 const equipped = gameState.rodSkin === skin.id;
                                 return (
                                    <div key={skin.id} className={`p-3 border rounded-lg flex justify-between items-center ${equipped ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: skin.color }}></span>
                                                {skin.name}
                                                {equipped && <Palette size={14} className="text-green-600" />}
                                            </div>
                                            <div className="text-xs text-gray-500">{skin.desc}</div>
                                        </div>
                                        <button 
                                            onClick={() => buyOrEquipSkin(skin.id as RodSkinType, skin.price)}
                                            className={`px-3 py-1.5 rounded text-sm font-bold ${owned 
                                                ? (equipped ? 'bg-gray-300 text-gray-600 cursor-default' : 'bg-blue-500 text-white') 
                                                : 'bg-green-500 text-white'}`}
                                            disabled={equipped}
                                        >
                                            {owned ? (equipped ? 'Equipped' : 'Equip') : `${skin.price} G`}
                                        </button>
                                    </div>
                                 );
                             })}
                          </div>
                      )}

                      {shopTab === 'boats' && (
                         <div className="space-y-3">
                             {BOAT_SHOP.map(boat => {
                                 const owned = gameState.ownedBoats.includes(boat.id as BoatType);
                                 const equipped = gameState.boatType === boat.id;
                                 return (
                                    <div key={boat.id} className={`p-3 border rounded-lg flex justify-between items-center ${equipped ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {boat.name}
                                                {equipped && <Anchor size={14} className="text-green-600" />}
                                            </div>
                                            <div className="text-xs text-gray-500">{boat.desc}</div>
                                        </div>
                                        <button 
                                            onClick={() => buyOrEquipBoat(boat.id as BoatType, boat.price)}
                                            className={`px-3 py-1.5 rounded text-sm font-bold ${owned 
                                                ? (equipped ? 'bg-gray-300 text-gray-600 cursor-default' : 'bg-blue-500 text-white') 
                                                : 'bg-green-500 text-white'}`}
                                            disabled={equipped}
                                        >
                                            {owned ? (equipped ? 'Equipped' : 'Equip') : `${boat.price} G`}
                                        </button>
                                    </div>
                                 );
                             })}
                         </div>
                      )}
                   </div>
                 )}

                 {activePanel === 'inv' && (
                   <div className="space-y-2">
                     {gameState.inventory.length === 0 && <div className="text-center text-gray-400 py-8">Empty Net</div>}
                     {gameState.inventory.map(item => (
                       <div key={item.id} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden">
                              <img src={FISH_IMAGES[item.type] || FISH_IMAGES.common} alt="" className="w-full h-full object-cover" />
                           </div>
                           <div>
                             <div className="font-medium text-sm">{item.name}</div>
                             <div className="text-xs text-gray-500">{item.value} G</div>
                           </div>
                         </div>
                         <button onClick={() => sellFish(item.id)} className="text-green-600 text-xs font-bold border border-green-600 px-2 py-1 rounded hover:bg-green-50">
                           SELL
                         </button>
                       </div>
                     ))}
                   </div>
                 )}

                 {activePanel === 'museum' && (
                   <div>
                      <div className="mb-6 bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <h3 className="text-xs font-bold uppercase text-orange-800 mb-2">Current Mission</h3>
                        {gameState.currentMission ? (
                          <div className="text-sm">
                             Catch {gameState.currentMission.required} <span className="font-bold">{gameState.currentMission.fishName}</span>
                             <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
                                <div className="bg-green-500 h-full transition-all" style={{ width: `${(gameState.currentMission.count / gameState.currentMission.required) * 100}%`}}></div>
                             </div>
                             <div className="flex justify-between mt-1 text-xs text-gray-500">
                               <span>{gameState.currentMission.count} / {gameState.currentMission.required}</span>
                               <span>Reward: {gameState.currentMission.reward} G</span>
                             </div>
                          </div>
                        ) : <div>All Done!</div>}
                      </div>

                      <h3 className="font-bold mb-2 text-sm">Best Catches (Tap to View)</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(gameState.bestFish).map(key => (
                          <button 
                            key={key} 
                            onClick={() => openFishViewer(key)}
                            className="border rounded p-2 flex flex-col items-center text-center bg-gray-50 hover:bg-blue-50 transition-colors relative group"
                          >
                             <div className="absolute top-1 right-1 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={14} />
                             </div>
                             <img src={FISH_IMAGES[key]} className="w-12 h-12 object-contain mb-1 mix-blend-multiply" alt={gameState.bestFish[key].name}/>
                             <div className="font-bold text-xs">{gameState.bestFish[key].name}</div>
                             <div className="text-xs text-gray-500">{gameState.bestFish[key].value} G</div>
                          </button>
                        ))}
                      </div>
                   </div>
                 )}

                 {activePanel === 'settings' && (
                   <div className="space-y-4">
                       {installPrompt && (
                          <div className="p-4 border rounded-lg bg-green-50 border-green-100">
                             <h3 className="font-bold text-sm mb-2 text-green-800">Install App</h3>
                             <button 
                                 onClick={handleInstall}
                                 className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition flex items-center justify-center gap-2"
                             >
                                 <Download size={16} /> Add to Home Screen
                             </button>
                          </div>
                       )}

                       {isDebugUnlocked ? (
                         <>
                           <div className="p-4 border rounded-lg bg-gray-50">
                               <div className="flex justify-between items-center mb-2">
                                   <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                                       <Unlock size={14} className="text-green-500" /> Debug Tools
                                   </h3>
                                   <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">UNLOCKED</span>
                               </div>
                               <button 
                                   onClick={addDebugGold}
                                   className="w-full bg-yellow-500 text-white font-bold py-2 rounded hover:bg-yellow-600 transition flex items-center justify-center gap-2 mb-2"
                               >
                                   <Coins size={16} /> +1000 Gold
                               </button>
                           </div>

                           <div className="p-4 border rounded-lg bg-indigo-50 border-indigo-100">
                               <h3 className="font-bold text-sm mb-2 text-indigo-700">3D Fish Viewer (Debug)</h3>
                               <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                   {FISH_TYPES.map(fish => (
                                       <button
                                           key={fish.id}
                                           onClick={() => openFishViewer(fish.id)}
                                           className="text-xs text-left px-2 py-1.5 bg-white border border-indigo-200 rounded hover:bg-indigo-100 transition truncate flex items-center gap-2"
                                           title={fish.name}
                                       >
                                           <Eye size={12} className="text-indigo-400" />
                                           {fish.name}
                                       </button>
                                   ))}
                               </div>
                           </div>
                         </>
                       ) : (
                         <div className="p-4 border rounded-lg bg-gray-50">
                           <h3 className="font-bold text-sm mb-2 text-gray-700 flex items-center gap-2">
                               <Lock size={14} /> Developer Access
                           </h3>
                           <div className="flex gap-2">
                               <input 
                                   type="password" 
                                   placeholder="Enter Password"
                                   className="border rounded px-3 py-2 text-sm flex-1 outline-none focus:border-blue-500"
                                   value={debugPasswordInput}
                                   onChange={(e) => setDebugPasswordInput(e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && handleDebugUnlock()}
                               />
                               <button 
                                   onClick={handleDebugUnlock}
                                   className="bg-gray-800 text-white font-bold px-4 py-2 rounded text-sm hover:bg-black transition"
                               >
                                   Unlock
                               </button>
                           </div>
                         </div>
                       )}

                       <div className="p-4 border rounded-lg bg-red-50 border-red-100">
                           <h3 className="font-bold text-sm mb-2 text-red-700">Danger Zone</h3>
                           <button 
                               onClick={() => {
                                   if(confirm("Reset all progress? This cannot be undone.")) {
                                       localStorage.removeItem(STORAGE_KEY);
                                       window.location.reload();
                                   }
                               }}
                               className="w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition flex items-center justify-center gap-2"
                           >
                               <RotateCcw size={16} /> Reset Save Data
                           </button>
                       </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-xl font-bold pointer-events-none transition-opacity duration-300 z-50 ${toastMsg ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
         {toastMsg}
      </div>

      <style>{`
        @keyframes slideLeft {
            from { transform: translateX(50px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(0,0,0,0.2);
            border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default App;