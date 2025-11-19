
import * as THREE from 'three';
import { WeatherType } from '../types';

interface Spot {
  group: THREE.Group;
  ring: THREE.Mesh;
  bubbles: THREE.Points;
  life: number;
  maxLife: number;
  active: boolean;
}

export class FishingSpotController {
  group: THREE.Group;
  private spots: Spot[] = [];
  private spawnTimer: number = 0;
  private maxSpots: number = 5;

  constructor() {
    this.group = new THREE.Group();
    this.initSpots();
  }

  private initSpots() {
    const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
    ringGeo.rotateX(-Math.PI / 2);

    const bubbleGeo = new THREE.BufferGeometry();
    const bubblePos = [];
    for (let i = 0; i < 10; i++) {
      bubblePos.push((Math.random() - 0.5) * 1.5, Math.random() * 0.5, (Math.random() - 0.5) * 1.5);
    }
    bubbleGeo.setAttribute('position', new THREE.Float32BufferAttribute(bubblePos, 3));

    for (let i = 0; i < this.maxSpots; i++) {
      const spotGroup = new THREE.Group();
      
      // Rippling Ring
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0, 
        side: THREE.DoubleSide 
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      spotGroup.add(ring);

      // Rising Bubbles
      const bubbleMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0
      });
      const bubbles = new THREE.Points(bubbleGeo.clone(), bubbleMat);
      spotGroup.add(bubbles);

      spotGroup.visible = false;
      this.group.add(spotGroup);

      this.spots.push({
        group: spotGroup,
        ring: ring,
        bubbles: bubbles,
        life: 0,
        maxLife: 0,
        active: false
      });
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }

  update(dt: number, weather: { weather: WeatherType, time: number }) {
    this.handleSpawning(dt, weather);
    this.animateSpots(dt, weather);
  }

  private handleSpawning(dt: number, weather: { weather: WeatherType, time: number }) {
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      // Determine spawn rate based on conditions
      let spawnChance = 1.0;
      let cooldown = 5.0;

      // Rain/Storm = More activity
      if (weather.weather === 'RAIN') { spawnChance = 0.8; cooldown = 3.0; }
      if (weather.weather === 'STORM') { spawnChance = 0.6; cooldown = 2.0; }

      // Dawn (5-7) and Dusk (17-19) = High activity
      if ((weather.time > 5 && weather.time < 7) || (weather.time > 17 && weather.time < 19)) {
         spawnChance = 0.9;
         cooldown = 2.5;
      }

      if (Math.random() < spawnChance) {
        this.activateSpot(weather);
      }
      
      this.spawnTimer = cooldown + Math.random() * 2.0;
    }
  }

  private activateSpot(weather: { weather: WeatherType, time: number }) {
    const spot = this.spots.find(s => !s.active);
    if (!spot) return;

    spot.active = true;
    spot.maxLife = 4.0 + Math.random() * 2.0;
    spot.life = spot.maxLife;
    spot.group.visible = true;

    // Random position in casting range
    const x = (Math.random() - 0.5) * 60;
    const z = -15 - Math.random() * 50; // Between -15 and -65
    spot.group.position.set(x, 0.05, z); // Slightly above water to prevent z-fighting

    // Set Color based on time (Bioluminescence at night)
    const isNight = weather.time < 6 || weather.time > 19;
    const color = isNight ? 0x00ffff : 0xffffff;
    
    (spot.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    (spot.bubbles.material as THREE.PointsMaterial).color.setHex(color);
  }

  private animateSpots(dt: number, weather: { weather: WeatherType, time: number }) {
    this.spots.forEach(spot => {
      if (!spot.active) return;

      spot.life -= dt;
      const progress = 1 - (spot.life / spot.maxLife);

      // Ring Animation: Expand and fade
      // Loop the ring animation twice during the spot's life
      const ringLoop = (progress * 3) % 1; 
      spot.ring.scale.setScalar(1 + ringLoop * 3);
      (spot.ring.material as THREE.MeshBasicMaterial).opacity = (1 - ringLoop) * 0.5 * Math.sin(Math.PI * (spot.life / spot.maxLife));

      // Bubble Animation: Rise and jitter
      const positions = spot.bubbles.geometry.attributes.position.array as Float32Array;
      for(let i=0; i < positions.length / 3; i++) {
          positions[i*3 + 1] += dt * 0.5; // Rise
          if (positions[i*3 + 1] > 0.8) positions[i*3 + 1] = 0; // Reset height
      }
      spot.bubbles.geometry.attributes.position.needsUpdate = true;
      (spot.bubbles.material as THREE.PointsMaterial).opacity = Math.min(1, spot.life);

      if (spot.life <= 0) {
        spot.active = false;
        spot.group.visible = false;
      }
    });
  }
}
