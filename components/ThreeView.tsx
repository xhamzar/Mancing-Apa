
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { Water } from 'three/addons/objects/Water.js';
// @ts-ignore
import { Sky } from 'three/addons/objects/Sky.js';
// @ts-ignore
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// @ts-ignore
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// @ts-ignore
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// @ts-ignore
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { RodController } from './RodController';
import { BoatController } from './BoatController';
import { BobberController } from './BobberController';
import { WeatherController } from './WeatherController';
import { FishingSpotController } from './FishingSpotController';
import { SeabedController } from './SeabedController'; // Import Seabed
import { WeatherType, BoatType, RodSkinType } from '../types';

interface ThreeViewProps {
  rodLevel: number;
  enchant: string;
  boatType: BoatType;
  rodSkin: RodSkinType;
  onReady?: (api: ThreeViewApi) => void;
  onWeatherUpdate?: (weather: WeatherType, time: number) => void;
}

export interface ThreeViewApi {
  cast: (distance: number) => void;
  reset: () => void;
  setReeling: (reeling: boolean) => void;
}

const ThreeView: React.FC<ThreeViewProps> = ({ rodLevel, enchant, boatType, rodSkin, onReady, onWeatherUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ThreeViewApi>({ cast: () => {}, reset: () => {}, setReeling: () => {} });
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  const rodCtrlRef = useRef<RodController | null>(null);
  const boatCtrlRef = useRef<BoatController | null>(null);
  const bobberCtrlRef = useRef<BobberController | null>(null);
  const weatherCtrlRef = useRef<WeatherController | null>(null);
  const spotCtrlRef = useRef<FishingSpotController | null>(null);
  const seabedCtrlRef = useRef<SeabedController | null>(null); // Seabed Ref

  const objectsRef = useRef<{
    line: THREE.Line | null;
    water: any | null;
  }>({ line: null, water: null });

  const stateRef = useRef({
    isCasted: false,
    targetPos: new THREE.Vector3(0, 0, 0),
  });
  
  const lastWeatherReportRef = useRef<{weather: WeatherType, hour: number}>({ weather: 'CLEAR', hour: -1 });

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, -10);

    // 2. Renderer
    // Use powerPreference default to be less aggressive on GPU resources
    const renderer = new THREE.WebGLRenderer({ 
        antialias: false, 
        powerPreference: "default",
        depth: true,
        stencil: false
    }); 
    rendererRef.current = renderer; // Assign immediately for safety

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Limit pixel ratio to save resources on high-DPI screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    containerRef.current.appendChild(renderer.domElement);

    // 3. Post Processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.4, // Strength
        0.4, // Radius
        0.6  // Threshold
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(30, 100, 10);
    dirLight.castShadow = true;
    // Optimize shadow map size
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    // 5. Environment
    const sun = new THREE.Vector3();
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const phi = THREE.MathUtils.degToRad(88);
    const theta = THREE.MathUtils.degToRad(180);
    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms['sunPosition'].value.copy(sun);
    
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    
    // Generate Water Normal Texture Programmatically to avoid loading errors/black screen
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if(ctx) {
        ctx.fillStyle = '#8080ff'; // Flat normal blueish
        ctx.fillRect(0,0,512,512);
        // Simple noise simulation for normals
        for(let i=0; i<20000; i++) {
            const x = Math.random()*512;
            const y = Math.random()*512;
            ctx.fillStyle = Math.random() > 0.5 ? '#8585ff' : '#7b7bff';
            ctx.fillRect(x,y, 4, 4);
        }
    }
    const normalMap = new THREE.CanvasTexture(canvas);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

    const water = new Water(
        waterGeometry,
        {
            textureWidth: 512, 
            textureHeight: 512,
            waterNormals: normalMap,
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x004966, 
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );
    water.rotation.x = -Math.PI / 2;
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();
    scene.add(water);
    objectsRef.current.water = water;

    // 6. Controllers
    const boatCtrl = new BoatController();
    boatCtrl.addToScene(scene);
    boatCtrlRef.current = boatCtrl;

    const rodCtrl = new RodController();
    rodCtrl.addToScene(scene);
    rodCtrlRef.current = rodCtrl;

    const bobberCtrl = new BobberController();
    bobberCtrl.addToScene(scene);
    bobberCtrlRef.current = bobberCtrl;

    const spotCtrl = new FishingSpotController();
    spotCtrl.addToScene(scene);
    spotCtrlRef.current = spotCtrl;

    // 6.5 SEABED (Atlantis)
    const seabedCtrl = new SeabedController();
    seabedCtrl.addToScene(scene);
    seabedCtrlRef.current = seabedCtrl;

    // 7. Objects
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, opacity: 0.6, transparent: true });
    const points = [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    objectsRef.current.line = line;

    // 8. Weather
    const weatherCtrl = new WeatherController(scene, sky, dirLight, ambientLight, water);
    weatherCtrlRef.current = weatherCtrl;

    // Animation Loop
    let animationId: number;
    let lastTime = Date.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const time = now * 0.001;

      if (objectsRef.current.water) {
        objectsRef.current.water.material.uniforms['time'].value += 1.0 / 60.0;
      }

      if (weatherCtrlRef.current) {
        weatherCtrlRef.current.update(dt);
        
        // Toggle Boat Lights at Night
        const weatherState = weatherCtrlRef.current.state;
        const isNight = weatherState.time < 6 || weatherState.time > 18;
        if (boatCtrlRef.current) boatCtrlRef.current.setNightMode(isNight);

        // Update Fishing Spots based on Weather
        if (spotCtrlRef.current) {
          spotCtrlRef.current.update(dt, weatherState);
        }

        // Sync Weather to React
        if (onWeatherUpdate) {
            const currentHour = Math.floor(weatherState.time);
            const last = lastWeatherReportRef.current;
            
            if (last.weather !== weatherState.weather || last.hour !== currentHour) {
                lastWeatherReportRef.current = { weather: weatherState.weather, hour: currentHour };
                onWeatherUpdate(weatherState.weather, weatherState.time);
            }
        }
      }

      if (rodCtrlRef.current) rodCtrlRef.current.animate(time);
      if (boatCtrlRef.current) boatCtrlRef.current.animate(time);
      if (bobberCtrlRef.current) bobberCtrlRef.current.animate(time);
      if (seabedCtrlRef.current) seabedCtrlRef.current.animate(time);

      // Rod/Line/Bobber Logic
      const { isCasted, targetPos } = stateRef.current;
      const { line } = objectsRef.current;
      const rodTipPos = new THREE.Vector3();
      if (rodCtrlRef.current) rodCtrlRef.current.getTipWorldPosition(rodTipPos);

      if (isCasted && bobberCtrlRef.current && line) {
        bobberCtrlRef.current.position.lerp(targetPos, 0.05);
        
        // Subtle bobbing animation
        const bobble = Math.sin(time * 2.5) * 0.04 + Math.cos(time * 1.5) * 0.02;
        bobberCtrlRef.current.position.y = bobble - 0.05;

        const positions = line.geometry.attributes.position.array as Float32Array;
        positions[0] = rodTipPos.x; positions[1] = rodTipPos.y; positions[2] = rodTipPos.z;
        positions[3] = bobberCtrlRef.current.position.x; 
        positions[4] = bobberCtrlRef.current.position.y + 0.3; 
        positions[5] = bobberCtrlRef.current.position.z;
        line.geometry.attributes.position.needsUpdate = true;
      } else if (line && !isCasted) {
         const positions = line.geometry.attributes.position.array as Float32Array;
         positions[0] = rodTipPos.x; positions[1] = rodTipPos.y; positions[2] = rodTipPos.z;
         const swingX = Math.sin(time * 1.5) * 0.1;
         const swingZ = Math.cos(time * 1.2) * 0.1;
         positions[3] = rodTipPos.x + swingX; positions[4] = rodTipPos.y - 1.5; positions[5] = rodTipPos.z + swingZ;
         line.geometry.attributes.position.needsUpdate = true;
      }

      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // CLEANUP
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      
      // Dispose Scene Objects
      scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) {
                  object.material.forEach((m: any) => m.dispose());
              } else {
                  object.material.dispose();
              }
          }
      });
      
      // Dispose Composer and its passes/targets
      composer.dispose();

      // Dispose Renderer and Force Context Loss
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch (e) { console.warn('Force context loss failed', e); }
      
      // Remove Canvas from DOM
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Clear Refs
      rendererRef.current = null;
      sceneRef.current = null;
      rodCtrlRef.current = null;
      boatCtrlRef.current = null;
      bobberCtrlRef.current = null;
      weatherCtrlRef.current = null;
      spotCtrlRef.current = null;
      seabedCtrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rodCtrlRef.current) {
      rodCtrlRef.current.update(rodLevel, enchant, rodSkin);
    }
    if (bobberCtrlRef.current) {
        bobberCtrlRef.current.updateEnchant(enchant);
    }
  }, [rodLevel, enchant, rodSkin]);

  useEffect(() => {
      if (boatCtrlRef.current) {
          boatCtrlRef.current.update(boatType);
      }
  }, [boatType]);

  apiRef.current.cast = (distance: number) => {
    stateRef.current.isCasted = true;
    if (rodCtrlRef.current) rodCtrlRef.current.triggerCast();
    
    if (bobberCtrlRef.current) {
      bobberCtrlRef.current.setVisible(true);
      const startPos = new THREE.Vector3();
      if (rodCtrlRef.current) rodCtrlRef.current.getTipWorldPosition(startPos);
      bobberCtrlRef.current.position.copy(startPos);
    }
    const zPos = -10 - (distance / 5);
    stateRef.current.targetPos.set(0, 0, zPos);
  };

  apiRef.current.reset = () => {
    stateRef.current.isCasted = false;
    if (rodCtrlRef.current) rodCtrlRef.current.setReeling(false);
    if (bobberCtrlRef.current) {
      bobberCtrlRef.current.setVisible(false);
    }
  };

  apiRef.current.setReeling = (reeling: boolean) => {
    if (rodCtrlRef.current) rodCtrlRef.current.setReeling(reeling);
  };

  useEffect(() => {
    if (onReady) onReady(apiRef.current);
  }, [onReady]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

export default React.memo(ThreeView);
