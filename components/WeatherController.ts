
import * as THREE from 'three';
import { WeatherType } from '../types';

export class WeatherController {
  private scene: THREE.Scene;
  private sky: any; // Sky shader object
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private water: any; // Water shader object
  
  // Lantern Light
  private lanternLight: THREE.PointLight;
  
  // State
  private timeOfDay: number = 8; // 0 - 24
  private currentWeather: WeatherType = 'CLEAR';
  
  // Rain System
  private rainSystem: THREE.Points | null = null;
  private rainCount: number = 2000;
  private rainGeo: THREE.BufferGeometry | null = null;
  private rainVelocities: Float32Array | null = null;

  // Fireflies System
  private firefliesSystem: THREE.Points | null = null;

  // Helper vectors
  private sunPosition: THREE.Vector3 = new THREE.Vector3();
  private sunColor: THREE.Color = new THREE.Color(0xffffff);
  private moonColor: THREE.Color = new THREE.Color(0x6688aa); // Brighter, bluer moon
  private sunsetColor: THREE.Color = new THREE.Color(0xffaa33);

  constructor(scene: THREE.Scene, sky: any, sunLight: THREE.DirectionalLight, ambientLight: THREE.AmbientLight, water: any) {
    this.scene = scene;
    this.sky = sky;
    this.sunLight = sunLight;
    this.ambientLight = ambientLight;
    this.water = water;
    
    // Init Lantern (Player personal light / Headlamp fallback)
    this.lanternLight = new THREE.PointLight(0xffaa00, 0, 40, 1.5);
    this.lanternLight.position.set(1.0, 2.5, 8); // Closer to camera/player
    this.lanternLight.castShadow = false; // Disable shadow for performance on extra lights
    this.scene.add(this.lanternLight);

    this.initRain();
    this.initFireflies();
    
    // Initial position set to avoid black sky on first frame
    this.updateSunPosition();
  }

  private initRain() {
    this.rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount);

    // Create a volume of rain around the play area
    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100; // X: -50 to 50
      positions[i * 3 + 1] = Math.random() * 60;      // Y: 0 to 60
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 10; // Z: -50 to 30
      
      // Random fall speed variation
      if (this.rainVelocities) {
        this.rainVelocities[i] = 0.5 + Math.random() * 0.5; 
      }
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.rainSystem = new THREE.Points(this.rainGeo, material);
    this.rainSystem.visible = false; // Hidden by default
    this.scene.add(this.rainSystem);
  }

  private initFireflies() {
    const count = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const phases = [];

    for(let i=0; i<count; i++) {
        positions.push(
            (Math.random() - 0.5) * 50, // x
            Math.random() * 3 + 0.5,    // y (0.5 to 3.5 units high)
            (Math.random() - 0.5) * 50 - 10 // z
        );
        phases.push(Math.random() * Math.PI * 2);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));

    const material = new THREE.PointsMaterial({
        color: 0xccff66, // Greenish yellow
        size: 0.15,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    this.firefliesSystem = new THREE.Points(geometry, material);
    this.firefliesSystem.visible = false;
    this.scene.add(this.firefliesSystem);
  }

  get state() {
    return {
      weather: this.currentWeather,
      time: this.timeOfDay
    };
  }

  update(dt: number) {
    // 1. Advance Time
    // speed 0.02 = ~20 minutes for 24 hours (Minecraft style)
    // 24 / 0.02 = 1200 seconds = 20 mins
    const speed = 0.02; 
    this.timeOfDay += dt * speed;
    if (this.timeOfDay >= 24) this.timeOfDay = 0;

    this.updateSunPosition();
    this.updateLighting(dt);
    this.updateRain(dt);
    this.updateFireflies(dt);
    this.updateEnvironmentState();
    this.updateWaterState();
  }

  private updateSunPosition() {
    const phi = THREE.MathUtils.mapLinear(Math.sin((this.timeOfDay - 6) / 24 * Math.PI * 2), -1, 1, Math.PI - 0.2, 0.2);
    const theta = Math.PI; 
    
    this.sunPosition.setFromSphericalCoords(1, phi, theta);
    
    // Update Sky Shader
    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
    
    // Update Water Sun Reflection
    this.water.material.uniforms['sunDirection'].value.copy(this.sunPosition).normalize();
    
    // Update Directional Light (Sun)
    this.sunLight.position.copy(this.sunPosition).multiplyScalar(100);
  }

  private updateLighting(dt: number) {
    const phi = THREE.MathUtils.mapLinear(Math.sin((this.timeOfDay - 6) / 24 * Math.PI * 2), -1, 1, Math.PI - 0.2, 0.2);
    const elevation = Math.PI / 2 - phi; // positive = day, negative = night

    // Cinematic Color Logic
    if (elevation > 0) {
        // DAY
        const t = Math.min(1, elevation / 0.5); 
        const currentColor = new THREE.Color().lerpColors(this.sunsetColor, this.sunColor, t);
        
        this.sunLight.color.copy(currentColor);
        this.sunLight.intensity = Math.max(0, Math.sin(elevation)) * 1.2;
        
        this.water.material.uniforms['sunColor'].value.copy(currentColor);

        const dayAmbient = new THREE.Color(0xccddff);
        const sunsetAmbient = new THREE.Color(0x553355);
        this.ambientLight.color.lerpColors(sunsetAmbient, dayAmbient, t);
        this.ambientLight.intensity = 0.3 + t * 0.3;

        this.sunLight.castShadow = true;

        if (this.scene.fog instanceof THREE.FogExp2) {
             const horizonColor = new THREE.Color(0xffaa66).lerp(new THREE.Color(0x87ceeb), t);
             this.scene.fog.color.lerp(horizonColor, 0.05);
        }

    } else {
        // NIGHT
        this.sunLight.color.copy(this.moonColor);
        this.sunLight.intensity = 0.4; // Boost moon brightness
        
        this.water.material.uniforms['sunColor'].value.copy(this.moonColor);
        
        // Boost Night Ambient so it's not pitch black
        this.ambientLight.color.setHex(0x102040);
        this.ambientLight.intensity = 0.3; 

        this.sunLight.castShadow = false;

        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color.lerp(new THREE.Color(0x050a15), 0.05);
       }
    }

    // Weather Overrides
    if (this.currentWeather === 'RAIN') {
        this.sunLight.intensity *= 0.5;
        this.ambientLight.color.lerp(new THREE.Color(0x556677), 0.5);
        if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.lerp(new THREE.Color(0x445566), 0.1);
    }
    if (this.currentWeather === 'STORM') {
        this.sunLight.intensity *= 0.2;
        this.ambientLight.color.lerp(new THREE.Color(0x222222), 0.8);
        if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.lerp(new THREE.Color(0x111111), 0.1);
    }

    // --- PLAYER LANTERN LOGIC ---
    // Use this as a fallback light if the boat doesn't have lights or for extra ambiance
    let lanternTarget = 0;
    if (elevation <= 0.1 || this.currentWeather === 'STORM') {
       lanternTarget = 1.0; // Slightly dimmer than before since we have boat lights
    }

    if (lanternTarget > 0) {
       const now = Date.now() * 0.001;
       const flicker = Math.sin(now * 10) * 0.1 + Math.cos(now * 23) * 0.1;
       lanternTarget += flicker;
       this.lanternLight.intensity = THREE.MathUtils.lerp(this.lanternLight.intensity, lanternTarget, 0.05);
    } else {
       this.lanternLight.intensity = THREE.MathUtils.lerp(this.lanternLight.intensity, 0, 0.05);
    }
  }

  private updateEnvironmentState() {
    if (Math.floor(this.timeOfDay) !== Math.floor(this.timeOfDay - 0.01)) {
        if (Math.random() < 0.2) {
            this.changeWeather();
        }
    }

    const uniforms = this.sky.material.uniforms;
    let targetTurbidity = 10; 
    let targetRayleigh = 2;   
    
    const phi = THREE.MathUtils.mapLinear(Math.sin((this.timeOfDay - 6) / 24 * Math.PI * 2), -1, 1, Math.PI - 0.2, 0.2);
    const elevation = Math.PI / 2 - phi;
    
    if (elevation > 0 && elevation < 0.3 && this.currentWeather === 'CLEAR') {
        targetRayleigh = 4; // Redder sunset/sunrise
    }

    switch (this.currentWeather) {
        case 'CLEAR':
            targetTurbidity = 2;
            break;
        case 'CLOUDY':
            targetTurbidity = 10;
            targetRayleigh = 1;
            break;
        case 'RAIN':
        case 'STORM':
            targetTurbidity = 20;
            targetRayleigh = 0.5;
            break;
    }

    uniforms['turbidity'].value = THREE.MathUtils.lerp(uniforms['turbidity'].value, targetTurbidity, 0.01);
    uniforms['rayleigh'].value = THREE.MathUtils.lerp(uniforms['rayleigh'].value, targetRayleigh, 0.01);

    if (this.scene.fog instanceof THREE.FogExp2) {
       let targetDensity = 0.002; 
       if (this.currentWeather === 'RAIN') targetDensity = 0.015;
       if (this.currentWeather === 'STORM') targetDensity = 0.025;
       
       // Morning Mist (around 5-7 AM)
       if (this.timeOfDay > 5 && this.timeOfDay < 7 && this.currentWeather === 'CLEAR') {
           targetDensity = 0.01; 
       }

       this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, 0.01);
    }
  }

  private changeWeather() {
    const r = Math.random();
    if (r < 0.5) this.currentWeather = 'CLEAR';
    else if (r < 0.8) this.currentWeather = 'CLOUDY';
    else if (r < 0.95) this.currentWeather = 'RAIN';
    else this.currentWeather = 'STORM';

    if (this.rainSystem) {
        this.rainSystem.visible = (this.currentWeather === 'RAIN' || this.currentWeather === 'STORM');
    }
  }

  private updateWaterState() {
    if (!this.water) return;
    
    const uniforms = this.water.material.uniforms;
    let targetDistortion = 3.7; // Default calm

    if (this.currentWeather === 'STORM') {
        targetDistortion = 8.0; // Choppy
    } else if (this.currentWeather === 'RAIN') {
        targetDistortion = 5.0;
    } else if (this.currentWeather === 'CLEAR' && (this.timeOfDay > 10 && this.timeOfDay < 14)) {
        targetDistortion = 3.0; // Very calm at noon
    }

    // Smoothly transition water state
    uniforms['distortionScale'].value = THREE.MathUtils.lerp(uniforms['distortionScale'].value, targetDistortion, 0.01);
  }

  private updateRain(dt: number) {
    if (!this.rainSystem || !this.rainSystem.visible || !this.rainGeo || !this.rainVelocities) return;

    const positions = this.rainGeo.attributes.position.array as Float32Array;
    const speedMultiplier = this.currentWeather === 'STORM' ? 1.5 : 1.0;

    for (let i = 0; i < this.rainCount; i++) {
        positions[i * 3 + 1] -= this.rainVelocities[i] * 40 * speedMultiplier * dt;
        positions[i * 3] -= 2 * dt; 

        if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 60;
            positions[i * 3] = (Math.random() - 0.5) * 100; 
        }
    }
    this.rainGeo.attributes.position.needsUpdate = true;
  }

  private updateFireflies(dt: number) {
      if (!this.firefliesSystem) return;

      // Only show fireflies at night during clear/cloudy weather
      const isNight = this.timeOfDay < 5.5 || this.timeOfDay > 19.0;
      const isCalm = this.currentWeather === 'CLEAR' || this.currentWeather === 'CLOUDY';
      
      this.firefliesSystem.visible = isNight && isCalm;

      if (this.firefliesSystem.visible) {
          const positions = this.firefliesSystem.geometry.attributes.position.array as Float32Array;
          const phases = this.firefliesSystem.geometry.attributes.phase.array as Float32Array;
          const time = Date.now() * 0.001;

          for(let i=0; i < positions.length / 3; i++) {
              // Gentle random drift
              positions[i*3] += Math.sin(time * 0.5 + phases[i]) * 0.01; 
              positions[i*3 + 1] += Math.cos(time * 0.3 + phases[i]) * 0.005; 
              positions[i*3 + 2] += Math.sin(time * 0.4 + phases[i]) * 0.01;

              // Wrap around if they drift too far
              if (positions[i*3 + 1] > 4) positions[i*3 + 1] = 0.5;
              if (positions[i*3 + 1] < 0) positions[i*3 + 1] = 3.5;
          }
          this.firefliesSystem.geometry.attributes.position.needsUpdate = true;
          
          // Blink effect
          (this.firefliesSystem.material as THREE.PointsMaterial).opacity = 0.3 + Math.abs(Math.sin(time * 2)) * 0.5;
      }
  }
}
