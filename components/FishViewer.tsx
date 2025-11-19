
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FishType } from '../types';

interface FishViewerProps {
  fishType: FishType;
  onClose: () => void;
}

const FishViewer: React.FC<FishViewerProps> = ({ fishType, onClose }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Interaction state
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b); // Slate 800
    scene.fog = new THREE.FogExp2(0x1e293b, 0.03);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1, 5.5);
    camera.lookAt(0, 0, 0);

    // Disable antialias for that crisp retro look (optional, but helps low poly style)
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        powerPreference: "default" 
    });
    rendererRef.current = renderer; // Assign immediately

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lighting (Stronger directional lights for faceted look)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.8);
    rimLight.position.set(-5, 2, -5);
    scene.add(rimLight);

    const bottomLight = new THREE.DirectionalLight(0xffaa00, 0.3);
    bottomLight.position.set(0, -5, 2);
    scene.add(bottomLight);

    // 3. Generate Fish Mesh
    const fishGroup = generateLowPolyFish(fishType);
    scene.add(fishGroup);

    // 4. Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      if (fishGroup) {
        const time = Date.now() * 0.001;
        if (!isDragging.current) {
             fishGroup.rotation.y += 0.005;
             fishGroup.position.y = Math.sin(time * 1.5) * 0.1;
        }
        
        // Simple procedural animation (Tail wag)
        const tail = fishGroup.getObjectByName("Tail");
        if (tail) {
            tail.rotation.y = Math.sin(time * 6) * 0.25;
        }
        const finL = fishGroup.getObjectByName("FinL");
        const finR = fishGroup.getObjectByName("FinR");
        if (finL && finR) {
            finL.rotation.z = Math.PI/3 + Math.sin(time * 10) * 0.15;
            finR.rotation.z = -Math.PI/3 - Math.sin(time * 10) * 0.15;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 5. Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      
      if (scene) {
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
      }

      // Explicit cleanup using the local 'renderer' variable
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch (e) { console.warn("Context loss failed", e); }
      
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }

      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, [fishType]);

  // --- Interaction Handlers ---
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    previousMousePosition.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !sceneRef.current) return;
    
    const fishGroup = sceneRef.current.children.find(c => c instanceof THREE.Group);
    if (!fishGroup) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const deltaX = clientX - previousMousePosition.current.x;
    const deltaY = clientY - previousMousePosition.current.y;

    fishGroup.rotation.y += deltaX * 0.01;
    fishGroup.rotation.x += deltaY * 0.01;

    previousMousePosition.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
      <div className="bg-slate-800 rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl border border-slate-600 flex flex-col relative">
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="absolute top-4 right-4 z-20 bg-slate-700 text-white p-2 rounded-full hover:bg-slate-600 transition"
        >
          ✕
        </button>
        
        <div className="p-4 text-center border-b border-slate-700 z-10 bg-slate-800/80">
          <h2 className="text-2xl font-bold text-white drop-shadow-md">{fishType.name}</h2>
          <div className="text-slate-400 text-sm">Low Poly Model Preview</div>
        </div>

        <div 
          ref={mountRef} 
          className="w-full h-[350px] cursor-move touch-none bg-gradient-to-b from-slate-800 to-slate-900 relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
            {/* Background Stylized */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent"></div>
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-4 text-white text-sm">
             <div className="bg-slate-700/50 p-3 rounded-lg text-center border border-slate-600">
               <div className="text-xs text-slate-400 uppercase tracking-wider">Rarity</div>
               <div className="font-bold text-lg" style={{ color: fishType.color }}>
                 {fishType.difficulty > 8 ? 'MYTHICAL' : fishType.difficulty > 6 ? 'LEGENDARY' : fishType.difficulty > 3 ? 'RARE' : 'COMMON'}
               </div>
             </div>
             <div className="bg-slate-700/50 p-3 rounded-lg text-center border border-slate-600">
               <div className="text-xs text-slate-400 uppercase tracking-wider">Value</div>
               <div className="font-bold text-lg text-green-400">~{Math.floor(fishType.base * 1.2)} G</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- LOW POLY GENERATOR ---

function generateLowPolyFish(fish: FishType): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(fish.color);
  
  // KEY TO LOW POLY: flatShading = true
  const mat = new THREE.MeshStandardMaterial({ 
      color: color, 
      roughness: 0.4, 
      metalness: 0.1,
      flatShading: true 
  });
  
  const bellyMat = new THREE.MeshStandardMaterial({ 
      color: color.clone().offsetHSL(0, 0.2, 0.3), 
      roughness: 0.5, 
      flatShading: true 
  });
  
  const finMat = new THREE.MeshStandardMaterial({ 
      color: color.clone().offsetHSL(0, 0, -0.1), 
      roughness: 0.6, 
      side: THREE.DoubleSide,
      flatShading: true
  });
  
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, flatShading: true });

  // Common fin geometry (Triangle)
  const createFin = (w: number, h: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(0,0);
      shape.lineTo(w, h/2);
      shape.lineTo(0, h);
      shape.lineTo(0,0);
      const geo = new THREE.ShapeGeometry(shape);
      return new THREE.Mesh(geo, finMat);
  };

  // --- SPECIES LOGIC ---
  // Uses includes() to handle mutant variants (e.g. 'dragon' matches 'dragon' and 'dragon_mutant')

  if (fish.id.includes('dragon')) {
     // === SEA DRAGON ===
     // Use a tube with VERY low segments (4 = square, 5 = pentagon)
     const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 1.5),
        new THREE.Vector3(0, -0.3, 0.5),
        new THREE.Vector3(0, 0.3, -0.5),
        new THREE.Vector3(0, 0, -1.5),
     ]);
     
     // 12 tubular segments, 4 radial (Square profile) for blocky look
     const tubeGeo = new THREE.TubeGeometry(path, 12, 0.2, 4, false);
     const body = new THREE.Mesh(tubeGeo, mat);
     group.add(body);

     // Head
     const headGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
     headGeo.rotateX(-Math.PI/2);
     const head = new THREE.Mesh(headGeo, mat);
     head.position.set(0, 0.1, 1.6);
     group.add(head);

     // Leaf Fins (Simple Planes)
     for(let i=0; i<5; i++) {
         const leafGeo = new THREE.CircleGeometry(0.2, 3); // Triangle leaves
         const leaf = new THREE.Mesh(leafGeo, finMat);
         const point = path.getPointAt(i/4);
         leaf.position.copy(point);
         leaf.position.y += 0.15;
         leaf.rotation.z = (i%2===0 ? 0.5 : -0.5);
         group.add(leaf);
     }

  } else if (fish.id.includes('cosmic') || fish.id.includes('shark')) {
     // === SHARK / MEGALODON ===
     // Lathe with low segments (5 or 6)
     const points = [];
     points.push(new THREE.Vector2(0, 2.5));
     points.push(new THREE.Vector2(0.5, 1.5));
     points.push(new THREE.Vector2(0.7, 0.5));
     points.push(new THREE.Vector2(0.4, -1.5));
     points.push(new THREE.Vector2(0, -3.0));
     
     const geo = new THREE.LatheGeometry(points, 6);
     geo.rotateX(Math.PI/2);
     const body = new THREE.Mesh(geo, mat);
     body.scale.z = 0.8; // flatten side-to-side slightly
     group.add(body);

     // Dorsal Fin (Triangle)
     const dorsal = createFin(0.8, 0.8);
     dorsal.rotation.y = -Math.PI/2;
     dorsal.rotation.z = -Math.PI/4;
     dorsal.position.set(0, 0.6, 0.2);
     group.add(dorsal);

     // Tail (Two triangles)
     const tailGroup = new THREE.Group();
     tailGroup.name = "Tail";
     tailGroup.position.z = -2.8;
     const topTail = createFin(1.0, 0.6);
     topTail.rotation.y = -Math.PI/2;
     topTail.rotation.z = Math.PI/3;
     const botTail = createFin(0.8, 0.5);
     botTail.rotation.y = -Math.PI/2;
     botTail.rotation.z = -Math.PI/3;
     tailGroup.add(topTail, botTail);
     group.add(tailGroup);

     // Eyes (Icosahedron is low poly sphere)
     const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), eyeMat);
     eye.position.set(0.35, 0.2, 1.8);
     group.add(eye);
     const eye2 = eye.clone();
     eye2.position.set(-0.35, 0.2, 1.8);
     group.add(eye2);

  } else if (fish.id.includes('ancient') || fish.id.includes('dunkle')) {
     // === BOX FISH / DUNKLEOSTEUS ===
     // Boxy head
     const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.4);
     const armorMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8, flatShading: true });
     const head = new THREE.Mesh(headGeo, armorMat);
     head.position.z = 0.8;
     group.add(head);

     // Tapered body
     const bodyGeo = new THREE.ConeGeometry(0.6, 2.5, 5);
     bodyGeo.rotateX(-Math.PI/2);
     const body = new THREE.Mesh(bodyGeo, mat);
     body.position.z = -1.2;
     group.add(body);

     // Tail
     const tailGroup = new THREE.Group();
     tailGroup.name = "Tail";
     tailGroup.position.z = -2.5;
     const tailFin = createFin(0.8, 0.8);
     tailFin.rotation.y = -Math.PI/2;
     tailGroup.add(tailFin);
     group.add(tailGroup);

  } else if (fish.id.includes('rare') || fish.id.includes('arowana')) {
     // === AROWANA (Elongated) ===
     const points = [];
     points.push(new THREE.Vector2(0, 2.0));
     points.push(new THREE.Vector2(0.4, 1.0));
     points.push(new THREE.Vector2(0.4, -1.0));
     points.push(new THREE.Vector2(0, -2.0));
     
     // 4 segments = Diamond profile
     const geo = new THREE.LatheGeometry(points, 4);
     geo.rotateX(Math.PI/2);
     geo.rotateZ(Math.PI/4); // Rotate so flat side is up/down? No, corner up looks like ridge.
     
     const body = new THREE.Mesh(geo, mat);
     body.scale.set(0.6, 1.2, 1.0);
     group.add(body);

     const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), eyeMat);
     eye.position.set(0.25, 0.1, 1.6);
     group.add(eye);
     const eye2 = eye.clone();
     eye2.position.set(-0.25, 0.1, 1.6);
     group.add(eye2);

     const tailGroup = new THREE.Group();
     tailGroup.name = "Tail";
     tailGroup.position.z = -2.0;
     const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.1, 0.8, 4, 1), finMat);
     tail.rotation.x = Math.PI/2;
     tail.scale.z = 0.1; // Flatten
     tailGroup.add(tail);
     group.add(tailGroup);

  } else if (fish.id.includes('legend') || fish.id.includes('coelacanth')) {
      // === COELACANTH (Bulky) ===
      const points = [];
      points.push(new THREE.Vector2(0, 1.5));
      points.push(new THREE.Vector2(0.6, 0.5));
      points.push(new THREE.Vector2(0.6, -0.5));
      points.push(new THREE.Vector2(0.3, -1.5));
      points.push(new THREE.Vector2(0, -2.0));

      const geo = new THREE.LatheGeometry(points, 8);
      geo.rotateX(Math.PI/2);
      const body = new THREE.Mesh(geo, mat);
      group.add(body);
      
      // Extra fins for coelacanth look
      const finB = createFin(0.6, 0.6);
      finB.rotation.y = -Math.PI/2;
      finB.rotation.z = Math.PI; 
      finB.position.y = -0.5;
      group.add(finB);

      const tailGroup = new THREE.Group();
      tailGroup.name = "Tail";
      tailGroup.position.z = -2.0;
      const tail = createFin(0.8, 0.8);
      tail.rotation.y = -Math.PI/2;
      tail.rotation.z = Math.PI/2;
      tailGroup.add(tail);
      group.add(tailGroup);

  } else {
     // === GENERIC FISH ===
     // Simple 2-cone construction
     const frontGeo = new THREE.ConeGeometry(0.5, 1.5, 6);
     frontGeo.rotateX(Math.PI/2);
     const front = new THREE.Mesh(frontGeo, mat);
     front.position.z = 0.75;
     group.add(front);

     const backGeo = new THREE.ConeGeometry(0.5, 1.5, 6);
     backGeo.rotateX(-Math.PI/2);
     const back = new THREE.Mesh(backGeo, mat);
     back.position.z = -0.75;
     group.add(back);

     const tailGroup = new THREE.Group();
     tailGroup.name = "Tail";
     tailGroup.position.z = -1.5;
     const tail = createFin(0.8, 0.8);
     tail.rotation.y = -Math.PI/2;
     tail.position.x = 0;
     tail.rotation.z = Math.PI/2; // vertical tail
     tailGroup.add(tail);
     group.add(tailGroup);

     const finL = createFin(0.5, 0.5);
     finL.name = "FinL";
     finL.position.set(0.4, -0.2, 0.5);
     finL.rotation.y = -Math.PI/2;
     finL.rotation.z = -Math.PI/3;
     group.add(finL);
     
     const finR = createFin(0.5, 0.5);
     finR.name = "FinR";
     finR.position.set(-0.4, -0.2, 0.5);
     finR.rotation.y = -Math.PI/2;
     finR.rotation.z = Math.PI/3; // Flip
     group.add(finR);

     const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), eyeMat);
     eye.position.set(0.3, 0.1, 1.0);
     group.add(eye);
     const eye2 = eye.clone();
     eye2.position.set(-0.3, 0.1, 1.0);
     group.add(eye2);
  }

  return group;
}

export default FishViewer;
