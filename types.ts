
export type WeatherType = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'STORM';
export type BoatType = 'wooden' | 'fiberglass' | 'yacht';
export type RodSkinType = 'default' | 'carbon' | 'magma' | 'cyber' | 'bamboo' | 'samurai' | 'bone';

export type EventType = 'GOLD_RUSH' | 'LUCKY_WATERS' | 'FEEDING_FRENZY';

export interface ActiveEvent {
  type: EventType;
  name: string;
  endTime: number; // Timestamp
}

export interface FishType {
  id: string;
  name: string;
  displayName: string;
  color: string;
  base: number;
  weight: number; // Base rarity weight (lower is rarer)
  difficulty: number;
  
  // Catch Criteria
  minDistance: number; // Minimum cast distance required
  requiredWeather?: WeatherType[]; // If defined, only bites during these weathers
  requiredTime?: 'DAY' | 'NIGHT'; // If defined, only bites during this time
  requiredEnchant?: string[]; // If defined, requires specific rod enchant
}

export interface InventoryItem {
  id: string;
  type: string;
  name: string;
  value: number;
  ts: number;
}

export interface Enchant {
  id: string;
  name: string;
  weight: number;
}

export interface Mission {
  fishType: string;
  fishName: string;
  required: number;
  count: number;
  reward: number;
}

export interface GameState {
  gold: number;
  rodLevel: number;
  maxDistance: number;
  inventory: InventoryItem[];
  equippedEnchant: string;
  bestFish: Record<string, { name: string; value: number }>;
  currentMission: Mission | null;
  
  // Boat State
  boatType: BoatType;
  ownedBoats: BoatType[];

  // Rod Skin State
  rodSkin: RodSkinType;
  ownedSkins: RodSkinType[];
  
  // Event State (Persisted so reloading doesn't kill an active event immediately)
  savedEvent: ActiveEvent | null;
}

export type GameStatus = 'idle' | 'casting' | 'floating' | 'bite' | 'pulling' | 'reeling';