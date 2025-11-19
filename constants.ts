
import { FishType, Enchant } from './types';

export const FISH_TYPES: FishType[] = [
  // --- TIER 1: COMMON ---
  {
    id:'common', name:'Goldfish', displayName:'Goldfish', color: '#F59E0B', 
    base:20, weight:100, difficulty:1, 
    minDistance: 0
  },
  {
    id:'common_mutant', name:'Toxic Goldfish', displayName:'Toxic Goldfish', color: '#39FF14', 
    base:50, weight:15, difficulty:3, 
    minDistance: 20, requiredWeather: ['RAIN', 'STORM']
  },

  // --- TIER 2: UNCOMMON ---
  {
    id:'blue', name:'Neon Tetra', displayName:'Neon Tetra', color: '#0077be', 
    base:60, weight:60, difficulty:2, 
    minDistance: 50
  },
  {
    id:'blue_mutant', name:'Plasma Tetra', displayName:'Plasma Tetra', color: '#00FFFF', 
    base:120, weight:10, difficulty:4, 
    minDistance: 60, requiredTime: 'NIGHT'
  },

  // --- TIER 3: RARE ---
  {
    id:'rare', name:'Arowana', displayName:'Arowana', color: '#8E44AD', 
    base:180, weight:25, difficulty:4, 
    minDistance: 100, requiredTime: 'DAY'
  },
  {
    id:'rare_mutant', name:'Ghost Arowana', displayName:'Ghost Arowana', color: '#E0E0E0', 
    base:350, weight:5, difficulty:6, 
    minDistance: 120, requiredWeather: ['CLOUDY', 'STORM']
  },

  // --- TIER 4: LEGENDARY ---
  {
    id:'legend', name:'Coelacanth', displayName:'Coelacanth', color: '#D9534F', 
    base:500, weight:10, difficulty:7, 
    minDistance: 200, requiredTime: 'NIGHT'
  },
  {
    id:'legend_mutant', name:'Cursed Coelacanth', displayName:'Cursed Coelacanth', color: '#2F4F4F', 
    base:900, weight:3, difficulty:8, 
    minDistance: 210, requiredEnchant: ['lucky', 'ancient', 'deep']
  },

  // --- TIER 5: ANCIENT ---
  {
    id:'ancient', name:'Dunkleosteus', displayName:'Dunkleosteus', color: '#4B0082', 
    base:300, weight:8, difficulty:5, 
    minDistance: 180, requiredWeather: ['RAIN', 'STORM']
  },
  {
    id:'ancient_mutant', name:'Magma Dunkle', displayName:'Magma Dunkleosteus', color: '#FF4500', 
    base:700, weight:4, difficulty:7, 
    minDistance: 190, requiredTime: 'DAY'
  },

  // --- TIER 6: MYTHICAL ---
  {
    id:'mythical', name:'Leedsichthys', displayName:'Leedsichthys', color: '#FF69B4', 
    base:400, weight:5, difficulty:6, 
    minDistance: 220, requiredWeather: ['CLOUDY', 'RAIN']
  },

  // --- TIER 7: COSMIC ---
  {
    id:'cosmic', name:'Megalodon', displayName:'Megalodon', color: '#001F3F', 
    base:800, weight:3, difficulty:8, 
    minDistance: 280, requiredTime: 'NIGHT'
  },
  {
    id:'cosmic_mutant', name:'Abyssal Megalodon', displayName:'Abyssal Megalodon', color: '#000000', 
    base:1500, weight:1, difficulty:9, 
    minDistance: 300, requiredEnchant: ['deep', 'ancient']
  },

  // --- TIER 8: SPECIAL ---
  {
    id:'rainbow', name:'Rainbow Trout', displayName:'Rainbow Trout', color: '#FF7F00', 
    base:1000, weight:2, difficulty:9, 
    minDistance: 150, requiredWeather: ['CLEAR']
  },

  // --- TIER 9: DRAGON ---
  {
    id:'dragon', name:'Sea Dragon', displayName:'Sea Dragon', color: '#FF4500', 
    base:2500, weight:0.5, difficulty:10, 
    minDistance: 320, requiredWeather: ['STORM'], requiredEnchant: ['ancient', 'lucky']
  },
  {
    id:'dragon_mutant', name:'Void Dragon', displayName:'Void Dragon', color: '#9900FF', 
    base:5000, weight:0.1, difficulty:10, 
    minDistance: 350, requiredWeather: ['STORM'], requiredEnchant: ['ancient']
  }
];

export const ENCHANT_POOL: Enchant[] = [
  {id:'lucky', name:'Lucky', weight: 30},
  {id:'deep', name:'Deep', weight: 25},
  {id:'steady', name:'Steady', weight: 25},
  {id:'golden', name:'Golden', weight: 15},
  {id:'ancient', name:'Ancient', weight: 5}
];

export const BOAT_SHOP = [
  { id: 'wooden', name: 'Old Rowboat', price: 0, desc: 'Classic and reliable.' },
  { id: 'fiberglass', name: 'Speedboat', price: 1500, desc: 'Sleek design for the modern fisher.' },
  { id: 'yacht', name: 'Luxury Yacht', price: 8000, desc: 'The ultimate status symbol.' },
];

export const ROD_SKINS = [
  { id: 'default', name: 'Standard', price: 0, desc: 'Changes appearance based on level.', color: '#8B4513' },
  { id: 'carbon', name: 'Carbon Fiber', price: 500, desc: 'Sleek, matte black lightweight composite.', color: '#333333' },
  { id: 'bamboo', name: 'Zen Bamboo', price: 800, desc: 'Traditional craftsmanship.', color: '#8ba858' },
  { id: 'magma', name: 'Magma Forged', price: 2500, desc: 'Glowing with the heat of the earth.', color: '#ff4500' },
  { id: 'cyber', name: 'Cyberpunk 2077', price: 5000, desc: 'Neon lights and futuristic metal.', color: '#00ffff' },
  { id: 'samurai', name: 'Ronin Blade', price: 3500, desc: 'Folded steel rod with a Katana hilt.', color: '#d4af37' },
  { id: 'bone', name: 'Leviathan Bone', price: 4000, desc: 'Carved from the spine of a sea beast.', color: '#e3DAC9' },
];

export const FISH_IMAGES: Record<string, string> = {
  common: 'https://placehold.co/200x200/F59E0B/ffffff?text=Goldfish',
  common_mutant: 'https://placehold.co/200x200/39FF14/000000?text=Toxic+Gold',

  blue: 'https://placehold.co/200x200/0077be/ffffff?text=Neon+Tetra',
  blue_mutant: 'https://placehold.co/200x200/00FFFF/000000?text=Plasma+Tetra',

  rare: 'https://placehold.co/200x200/8E44AD/ffffff?text=Arowana',
  rare_mutant: 'https://placehold.co/200x200/E0E0E0/000000?text=Ghost+Arowana',

  legend: 'https://placehold.co/200x200/D9534F/ffffff?text=Coelacanth',
  legend_mutant: 'https://placehold.co/200x200/2F4F4F/ffffff?text=Cursed+Coel',

  ancient: 'https://placehold.co/200x200/4B0082/ffffff?text=Dunkleosteus',
  ancient_mutant: 'https://placehold.co/200x200/FF4500/ffffff?text=Magma+Dunkle',

  mythical: 'https://placehold.co/200x200/FF69B4/ffffff?text=Leedsichthys',

  cosmic: 'https://placehold.co/200x200/001F3F/ffffff?text=Megalodon',
  cosmic_mutant: 'https://placehold.co/200x200/000000/ffffff?text=Abyssal+Meg',

  rainbow: 'https://placehold.co/200x200/FF7F00/ffffff?text=Rainbow+Trout',

  dragon: 'https://placehold.co/200x200/FF4500/ffffff?text=Sea+Dragon',
  dragon_mutant: 'https://placehold.co/200x200/9900FF/ffffff?text=Void+Dragon',
};
