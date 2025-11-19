
import * as THREE from 'three';
import { RodSkinType } from '../types';

export class RodController {
  group: THREE.Group;
  private rodMaterial: THREE.MeshPhysicalMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;
  private tip: THREE.Object3D;
  
  // Segmented Shaft for Bending
  private rodBase: THREE.Mesh;
  private rodMid: THREE.Mesh;
  private rodTipSection: THREE.Mesh;

  // Skin Specific Geometry Containers
  private bambooNodes: THREE.Group[] = [];
  private cyberDetails: THREE.Group[] = [];
  private samuraiDetails: THREE.Group[] = [];
  private boneDetails: THREE.Group[] = [];
  
  // Bone Skin Specifics
  private boneFingers: THREE.Group[] = []; // Store finger refs for animation
  private boneFog: THREE.Points | null = null; // The misty aura
  
  // Aura / Effect Group
  private effectsGroup: THREE.Group;
  private activeEnchant: string = 'none';
  
  // Animation State
  private baseRotation: THREE.Euler;
  private castStartTime: number = -1;
  private isReeling: boolean = false;
  
  // Particles / Dynamic references
  private particles: THREE.Points | null = null;
  private helix1: THREE.Mesh | null = null;
  private helix2: THREE.Mesh | null = null;
  private rings: THREE.Group | null = null;
  private auraLayers: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    
    // Materials
    this.handleMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.9 }); 
    this.rodMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x8B4513, 
        roughness: 0.4,
        metalness: 0.0,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0
    });

    // --- 1. HANDLE (Static) ---
    const handleGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.5, 16);
    const handle = new THREE.Mesh(handleGeo, this.handleMaterial);
    handle.position.y = -1.5;
    handle.castShadow = true;
    this.group.add(handle);

    // Reel mount (decoration)
    const reelGeo = new THREE.BoxGeometry(0.25, 0.4, 0.3);
    const reelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
    const reel = new THREE.Mesh(reelGeo, reelMat);
    reel.position.set(0, -1.2, 0.15);
    this.group.add(reel);

    // --- 2. SEGMENTED SHAFT (For Bending) ---
    // Total length approx 4.0. Split into 3 segments.
    // Segment pivots are at the bottom of each geometry.
    
    const segmentLen = 1.4;
    const segGeo1 = new THREE.CylinderGeometry(0.06, 0.07, segmentLen, 16);
    segGeo1.translate(0, segmentLen/2, 0); // Pivot at bottom

    const segGeo2 = new THREE.CylinderGeometry(0.04, 0.06, segmentLen, 16);
    segGeo2.translate(0, segmentLen/2, 0);

    const segGeo3 = new THREE.CylinderGeometry(0.02, 0.04, segmentLen, 16);
    segGeo3.translate(0, segmentLen/2, 0);

    // Base Segment (Attached to Handle/Group)
    this.rodBase = new THREE.Mesh(segGeo1, this.rodMaterial);
    this.rodBase.position.y = -0.8; // Start slightly inside handle
    this.rodBase.castShadow = true;
    this.group.add(this.rodBase);

    // Mid Segment (Attached to Base)
    this.rodMid = new THREE.Mesh(segGeo2, this.rodMaterial);
    this.rodMid.position.y = segmentLen - 0.05; // Overlap slightly
    this.rodMid.castShadow = true;
    this.rodBase.add(this.rodMid);

    // Tip Segment (Attached to Mid)
    this.rodTipSection = new THREE.Mesh(segGeo3, this.rodMaterial);
    this.rodTipSection.position.y = segmentLen - 0.05;
    this.rodTipSection.castShadow = true;
    this.rodMid.add(this.rodTipSection);

    // --- 3. GUIDES (Rings) ---
    // Distribute rings across the segments
    this.addRingTo(this.rodBase, 0.5);
    this.addRingTo(this.rodMid, 0.4);
    this.addRingTo(this.rodMid, 1.0);
    this.addRingTo(this.rodTipSection, 0.5);
    this.addRingTo(this.rodTipSection, 1.2); // Tip ring

    // --- 4. SKINS GEOMETRY SETUP ---
    // Initialize arrays for skin-specific geometry groups
    
    const createSkinGroups = () => [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    this.bambooNodes = createSkinGroups();
    this.cyberDetails = createSkinGroups();
    this.samuraiDetails = createSkinGroups();
    this.boneDetails = createSkinGroups();

    // Attach groups to segments
    [this.bambooNodes, this.cyberDetails, this.samuraiDetails, this.boneDetails].forEach(details => {
        this.rodBase.add(details[0]);
        this.rodMid.add(details[1]);
        this.rodTipSection.add(details[2]);
    });
    
    // -- Bamboo Population --
    this.populateBambooNode(this.bambooNodes[0], segmentLen, 0.065);
    this.populateBambooNode(this.bambooNodes[1], segmentLen, 0.05);
    this.populateBambooNode(this.bambooNodes[2], segmentLen, 0.03);

    // -- Cyber Population --
    this.populateCyberRing(this.cyberDetails[0], segmentLen * 0.5, 0.07);
    this.populateCyberRing(this.cyberDetails[1], segmentLen * 0.5, 0.05);
    this.populateCyberRing(this.cyberDetails[2], segmentLen * 0.8, 0.03);

    // -- Samurai Population --
    // 1. Tsuba (Guard) on Base
    const guardGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.3 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.05; // At bottom of rod shaft
    this.samuraiDetails[0].add(guard);
    
    // -- Bone Population (Skeletal Arm) --
    this.populateBoneArm(this.boneDetails[0], segmentLen, 0.07, 'base');
    this.populateBoneArm(this.boneDetails[1], segmentLen, 0.05, 'mid');
    this.populateBoneArm(this.boneDetails[2], segmentLen, 0.03, 'tip');

    // Create Fog for Bone Skin
    this.createBoneFog();


    // --- 5. TIP & EFFECTS ---
    this.tip = new THREE.Object3D();
    this.tip.position.set(0, segmentLen, 0); 
    this.rodTipSection.add(this.tip);
    
    this.effectsGroup = new THREE.Group();
    this.rodBase.add(this.effectsGroup);

    // Transform Whole Group
    this.group.position.set(0, 2.0, 8.5);
    this.baseRotation = new THREE.Euler(-1.2, 0, 0);
    this.group.rotation.copy(this.baseRotation);
  }

  private addRingTo(parent: THREE.Mesh, yPos: number) {
      const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.05, 0.006, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.2 })
      );
      ring.position.y = yPos;
      ring.position.z = -0.05;
      ring.rotation.x = Math.PI / 2;
      parent.add(ring);
  }

  private populateBambooNode(group: THREE.Group, len: number, radius: number) {
      for(let i=0; i<2; i++) {
          const node = new THREE.Mesh(
              new THREE.TorusGeometry(radius + 0.005, 0.008, 8, 16),
              new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
          );
          node.rotation.x = Math.PI/2;
          node.position.y = (len * 0.3) + i * (len * 0.4);
          node.scale.set(1, 1, 0.8);
          group.add(node);
      }
  }

  private populateCyberRing(group: THREE.Group, yPos: number, radius: number) {
      const neonMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(radius + 0.02, radius + 0.02, 0.02, 16, 1, true),
          neonMat
      );
      ring.position.y = yPos;
      group.add(ring);
  }

  private populateBoneArm(group: THREE.Group, len: number, radius: number, type: 'base'|'mid'|'tip') {
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8e3d9, roughness: 0.6, metalness: 0.1 });
      const jointMat = new THREE.MeshStandardMaterial({ color: 0xdcd0c0, roughness: 0.7 });

      if (type === 'base') {
          // --- HUMERUS (Upper Arm) ---
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.2, radius * 1.5, len * 0.8, 8), boneMat);
          shaft.position.y = len * 0.5;
          group.add(shaft);

          const head = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.5, 16, 16), jointMat);
          head.position.y = 0.1;
          head.scale.set(1, 1.2, 1);
          group.add(head);

          const elbow = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.5, radius * 1.5, radius * 2.5), jointMat);
          elbow.position.y = len - 0.1;
          group.add(elbow);

      } else if (type === 'mid') {
          // --- RADIUS & ULNA (Forearm) ---
          const boneRadius = radius * 0.6;
          const gap = radius * 1.2;

          const ulna = new THREE.Mesh(new THREE.CylinderGeometry(boneRadius, boneRadius * 1.2, len * 0.9, 8), boneMat);
          ulna.position.set(gap, len * 0.5, 0);
          group.add(ulna);

          const radBone = new THREE.Mesh(new THREE.CylinderGeometry(boneRadius * 1.2, boneRadius, len * 0.9, 8), boneMat);
          radBone.position.set(-gap, len * 0.5, 0);
          group.add(radBone);

          const elbowBack = new THREE.Mesh(new THREE.SphereGeometry(radius * 2, 16, 16), jointMat);
          elbowBack.position.set(0, 0.1, -0.05);
          group.add(elbowBack);

      } else if (type === 'tip') {
          // --- HAND (Wrist + Fingers) ---
          
          const wrist = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 2.5), jointMat);
          wrist.position.y = 0.1;
          wrist.scale.set(1, 0.6, 0.8);
          group.add(wrist);

          const palmLen = len * 0.35;
          const palmGroup = new THREE.Group();
          palmGroup.position.y = 0.3;
          group.add(palmGroup);

          for(let i=0; i<5; i++) {
              const xOff = (i - 2) * 0.03;
              const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, palmLen, 6), boneMat);
              bone.position.set(xOff, palmLen/2, 0);
              bone.rotation.z = -xOff * 2.0;
              palmGroup.add(bone);
          }

          // Fingers (Phalanges)
          const fingerGroup = new THREE.Group();
          fingerGroup.position.y = 0.3 + palmLen;
          group.add(fingerGroup);

          const createFinger = (x: number, length: number, width: number, angleZ: number, offset: number) => {
              const fGroup = new THREE.Group();
              fGroup.position.set(x, 0, 0);
              fGroup.rotation.z = angleZ;
              fGroup.userData = { initialZ: angleZ, offset: offset }; // Store for animation

              // Proximal Phalanx
              const p1 = new THREE.Mesh(new THREE.CylinderGeometry(width*0.8, width, length*0.4, 6), boneMat);
              p1.position.y = length*0.2;
              fGroup.add(p1);

              // Joint
              const j1 = new THREE.Mesh(new THREE.SphereGeometry(width), jointMat);
              j1.position.y = length*0.4;
              fGroup.add(j1);

              // Middle Phalanx
              const p2 = new THREE.Mesh(new THREE.CylinderGeometry(width*0.7, width*0.8, length*0.3, 6), boneMat);
              p2.position.y = length*0.55;
              p2.rotation.x = -0.1; 
              fGroup.add(p2);

              // Joint
              const j2 = new THREE.Mesh(new THREE.SphereGeometry(width*0.9), jointMat);
              j2.position.y = length*0.7;
              fGroup.add(j2);

              // Distal Phalanx
              const p3 = new THREE.Mesh(new THREE.CylinderGeometry(width*0.5, width*0.7, length*0.25, 6), boneMat);
              p3.position.y = length*0.825;
              p3.rotation.x = -0.1; 
              fGroup.add(p3);
              
              // Store reference
              this.boneFingers.push(fGroup);

              return fGroup;
          };

          // Clear previous if any (though constructor runs once)
          // this.boneFingers = []; // Do not clear here, constructor is sequential

          // Thumb
          fingerGroup.add(createFinger(0.06, 0.2, 0.012, -0.4, 0)); 
          // Index
          fingerGroup.add(createFinger(0.03, 0.25, 0.011, -0.1, 1));
          // Middle
          fingerGroup.add(createFinger(0.0, 0.28, 0.011, 0, 2));
          // Ring
          fingerGroup.add(createFinger(-0.03, 0.26, 0.011, 0.1, 3));
          // Pinky
          fingerGroup.add(createFinger(-0.06, 0.22, 0.010, 0.3, 4));
      }
  }

  private createBoneFog() {
    // Soft smoke texture generated programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if(ctx) {
        const grad = ctx.createRadialGradient(16,16,0, 16,16,16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,32,32);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const count = 80;
    const geom = new THREE.BufferGeometry();
    const pos = [];
    const colors = [];
    const sizes = [];
    const userData = [];

    const c1 = new THREE.Color(0x000000); // Black
    const c2 = new THREE.Color(0x5500aa); // Deep Purple
    const c3 = new THREE.Color(0xaaaaaa); // White/Grey mist

    for(let i=0; i<count; i++) {
        pos.push((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5);
        
        const r = Math.random();
        if (r < 0.33) colors.push(c1.r, c1.g, c1.b);
        else if (r < 0.66) colors.push(c2.r, c2.g, c2.b);
        else colors.push(c3.r, c3.g, c3.b);

        sizes.push(0.2 + Math.random() * 0.3);
        userData.push(Math.random() * Math.PI * 2, Math.random()); // Angle, speed
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geom.userData = { data: userData };

    const mat = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        map: texture,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.NormalBlending // Normal blending for smoke effect
    });

    this.boneFog = new THREE.Points(geom, mat);
    this.boneFog.position.y = 0.5; // Centered around hand
    // Attach to the tip section's geometry group for bone details so it moves with it
    if(this.boneDetails[2]) this.boneDetails[2].add(this.boneFog);
    this.boneFog.visible = false;
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.group);
  }

  getTipWorldPosition(target: THREE.Vector3) {
    this.tip.getWorldPosition(target);
  }

  triggerCast() {
    this.castStartTime = Date.now();
  }

  setReeling(isReeling: boolean) {
    this.isReeling = isReeling;
  }

  // --- EFFECT GENERATORS ---
  private createParticles(color: number, count: number, size: number, verticalSpeed: number) {
      const geom = new THREE.BufferGeometry();
      const pos = [];
      const userData = []; 
      
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.1 + Math.random() * 0.2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = Math.random() * 4.0; 
          pos.push(x, y, z);
          userData.push(Math.random(), Math.random(), Math.random()); 
      }
      
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.userData = { data: userData, speed: verticalSpeed };
      
      const mat = new THREE.PointsMaterial({
          color: color,
          size: size,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
      });
      
      this.particles = new THREE.Points(geom, mat);
      this.effectsGroup.add(this.particles);
  }

  private createHelix(color: number, radius: number, turns: number) {
      const points = [];
      const height = 4.5;
      const segments = 64;
      for(let i=0; i<=segments; i++) {
          const t = i / segments;
          const angle = t * Math.PI * 2 * turns;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = t * height;
          points.push(new THREE.Vector3(x, y, z));
      }
      const path = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(path, 64, 0.02, 8, false);
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
      return new THREE.Mesh(tubeGeo, mat);
  }

  private createAuraLayer(color: number, scale: number, opacity: number) {
      const geo = new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 4.5, 16, 8, true);
      geo.translate(0, 2.25, 0); // Pivot bottom
      const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: opacity,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
  }

  update(level: number, enchant: string, skin: RodSkinType) {
    // --- 1. SKIN VISUALS ---
    this.rodMaterial.emissive.setHex(0x000000);
    this.rodMaterial.emissiveIntensity = 0;
    this.rodMaterial.clearcoat = 0;
    this.rodMaterial.roughness = 0.5;
    this.rodMaterial.metalness = 0.0;
    
    // Hide all special details first
    this.bambooNodes.forEach(g => g.visible = false);
    this.cyberDetails.forEach(g => g.visible = false);
    this.samuraiDetails.forEach(g => g.visible = false);
    this.boneDetails.forEach(g => g.visible = false);
    
    // Hide Bone Fog default
    if (this.boneFog) this.boneFog.visible = false;

    this.handleMaterial.color.setHex(0x3E2723);

    if (skin === 'default') {
        if (level >= 10) {
            this.rodMaterial.color.setHex(0xFFD700);
            this.rodMaterial.metalness = 1.0;
            this.rodMaterial.roughness = 0.15;
            this.rodMaterial.clearcoat = 0.5;
        } else if (level >= 5) {
            this.rodMaterial.color.setHex(0x607D8B);
            this.rodMaterial.metalness = 0.8;
        } else if (level >= 3) {
            this.rodMaterial.color.setHex(0x8D6E63);
            this.rodMaterial.metalness = 0.2;
        } else {
            this.rodMaterial.color.setHex(0x8B4513);
        }
    } else {
        switch(skin) {
            case 'carbon':
                this.rodMaterial.color.setHex(0x111111);
                this.rodMaterial.roughness = 0.4;
                this.rodMaterial.metalness = 0.2;
                this.rodMaterial.clearcoat = 1.0; 
                this.handleMaterial.color.setHex(0x000000);
                break;
            case 'bamboo':
                this.rodMaterial.color.setHex(0xe6c288);
                this.rodMaterial.roughness = 0.7;
                this.handleMaterial.color.setHex(0x5d4037);
                this.bambooNodes.forEach(g => g.visible = true);
                break;
            case 'magma':
                this.rodMaterial.color.setHex(0x2b0a0a);
                this.rodMaterial.emissive.setHex(0xff3300);
                this.rodMaterial.emissiveIntensity = 0.8;
                this.rodMaterial.roughness = 0.9; 
                this.handleMaterial.color.setHex(0x1a0505);
                break;
            case 'cyber':
                this.rodMaterial.color.setHex(0x000022);
                this.rodMaterial.emissive.setHex(0x001133);
                this.rodMaterial.emissiveIntensity = 0.2;
                this.rodMaterial.metalness = 0.9;
                this.handleMaterial.color.setHex(0xff00ff);
                this.cyberDetails.forEach(g => g.visible = true);
                break;
            case 'samurai':
                // Metallic Black Shaft
                this.rodMaterial.color.setHex(0x222222);
                this.rodMaterial.metalness = 0.9;
                this.rodMaterial.roughness = 0.3;
                // Gold/Yellow wrapped handle look
                this.handleMaterial.color.setHex(0xdaa520); 
                this.samuraiDetails.forEach(g => g.visible = true);
                break;
            case 'bone':
                // Bleached Bone White
                this.rodMaterial.color.setHex(0xf0e6d2);
                this.rodMaterial.roughness = 1.0;
                this.rodMaterial.metalness = 0.0;
                this.handleMaterial.color.setHex(0xdccbb1);
                this.boneDetails.forEach(g => g.visible = true);
                if (this.boneFog) this.boneFog.visible = true; // Show Fog
                break;
        }
    }
    
    this.rodMaterial.needsUpdate = true;
    this.handleMaterial.needsUpdate = true;

    // --- 2. ENCHANT EFFECTS ---
    if (this.activeEnchant === enchant) return;
    this.activeEnchant = enchant;
    
    this.effectsGroup.clear();
    this.particles = null;
    this.helix1 = null;
    this.helix2 = null;
    this.rings = null;
    this.auraLayers = [];

    if (enchant === 'none') return;

    switch(enchant) {
        case 'lucky': 
            this.createParticles(0x4ade80, 20, 0.08, 1.5);
            const auraL = this.createAuraLayer(0x4ade80, 1.2, 0.2);
            this.effectsGroup.add(auraL);
            this.auraLayers.push(auraL);
            break;

        case 'deep': 
            const deep1 = this.createAuraLayer(0x0077be, 1.5, 0.3);
            const deep2 = this.createAuraLayer(0x00ffff, 1.1, 0.2);
            this.effectsGroup.add(deep1, deep2);
            this.auraLayers.push(deep1, deep2);
            break;

        case 'steady': 
            this.rings = new THREE.Group();
            for(let i=0; i<3; i++) {
                const r = new THREE.Mesh(
                    new THREE.TorusGeometry(0.2, 0.01, 8, 32),
                    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
                );
                r.rotation.x = Math.PI/2;
                r.position.y = 0.5 + i * 1.0;
                this.rings.add(r);
            }
            this.effectsGroup.add(this.rings);
            break;

        case 'golden': 
            this.createParticles(0xffd700, 40, 0.05, 0.5);
            const glow = this.createAuraLayer(0xffaa00, 1.0, 0.15);
            this.effectsGroup.add(glow);
            this.auraLayers.push(glow);
            break;

        case 'ancient':
            this.helix1 = this.createHelix(0x9d46ff, 0.2, 2);
            this.helix2 = this.createHelix(0xff00ff, 0.2, 2);
            this.helix2.rotation.y = Math.PI; 
            this.effectsGroup.add(this.helix1, this.helix2);
            
            const core = this.createAuraLayer(0x4b0082, 0.8, 0.3);
            this.effectsGroup.add(core);
            this.auraLayers.push(core);
            break;
    }
  }

  animate(time: number) {
     // --- 1. BENDING ANIMATION (PHYSICS) ---
     let targetBend = 0;
     let tensionVibration = 0;

     if (this.isReeling) {
         tensionVibration = Math.sin(time * 25) * 0.02 + Math.cos(time * 50) * 0.015;
         targetBend = 0.5 + tensionVibration; 
     }

     const speed = 0.08;
     const baseBend = THREE.MathUtils.lerp(this.rodBase.rotation.x, targetBend * 0.15, speed);
     this.rodBase.rotation.x = baseBend;

     const midBend = THREE.MathUtils.lerp(this.rodMid.rotation.x, targetBend * 0.35, speed);
     this.rodMid.rotation.x = midBend;

     const tipBend = THREE.MathUtils.lerp(this.rodTipSection.rotation.x, targetBend * 0.5, speed);
     this.rodTipSection.rotation.x = tipBend;


     // --- 2. CAST & REEL SHAKE (GROUP TRANSFORM) ---
     let castOffsetX = 0;
     if (this.castStartTime > 0) {
         const elapsed = (Date.now() - this.castStartTime) / 1000;
         const duration = 0.8;
         
         if (elapsed < duration) {
            if (elapsed < 0.3) {
                const t = elapsed / 0.3;
                castOffsetX = THREE.MathUtils.lerp(0, Math.PI / 4, t); 
            } else if (elapsed < 0.5) {
                const t = (elapsed - 0.3) / 0.2;
                castOffsetX = THREE.MathUtils.lerp(Math.PI / 4, -Math.PI / 3, t);
            } else {
                const t = (elapsed - 0.5) / 0.3;
                castOffsetX = THREE.MathUtils.lerp(-Math.PI / 3, 0, t);
            }
         } else {
             this.castStartTime = -1;
         }
     }

     let reelShakeY = 0;
     let reelShakeZ = 0;
     
     if (this.isReeling) {
         reelShakeY = (Math.random() - 0.5) * 0.03;
         reelShakeZ = (Math.random() - 0.5) * 0.03;
     } else {
         reelShakeZ = Math.sin(time * 0.5) * 0.015;
     }

     this.group.rotation.x = this.baseRotation.x + castOffsetX;
     this.group.rotation.y = this.baseRotation.y + reelShakeY;
     this.group.rotation.z = this.baseRotation.z + reelShakeZ;


     // --- 3. SKIN & EFFECT ANIMATIONS (Visuals) ---
     
     // Magma Pulse
     if (this.rodMaterial.emissiveIntensity > 0 && this.cyberDetails.length > 0 && !this.cyberDetails[0].visible) {
         this.rodMaterial.emissiveIntensity = 0.6 + Math.sin(time * 3) * 0.4;
     }
     
     // Cyber Rings
     if (this.cyberDetails.length > 0 && this.cyberDetails[0].visible) {
         this.cyberDetails.forEach((group, gIdx) => {
             group.children.forEach((child, i) => {
                 child.position.y = (i * 1.2) + Math.sin(time * 4 + i + gIdx) * 0.1;
                 child.rotation.y -= 0.05;
                 child.scale.setScalar(1.0 + Math.sin(time * 10) * 0.1); 
             });
         });
         this.rodMaterial.emissiveIntensity = 0.3 + Math.sin(time * 8) * 0.2;
     }
     
     // Bone Skin Animations (Finger twitch & Fog)
     if (this.boneDetails.length > 0 && this.boneDetails[0].visible) {
         // Animate Fingers
         this.boneFingers.forEach(finger => {
             const initialZ = finger.userData.initialZ;
             const offset = finger.userData.offset;
             // Gentle twitching / grasping motion
             const twitch = Math.sin(time * 2 + offset) * 0.15; 
             finger.rotation.z = initialZ + twitch;
         });

         // Animate Fog
         if (this.boneFog) {
             const positions = this.boneFog.geometry.attributes.position.array as Float32Array;
             const userData = this.boneFog.geometry.userData.data;
             
             for(let i=0; i < positions.length / 3; i++) {
                 const speed = userData[i*2 + 1] * 0.5 + 0.2;
                 positions[i*3 + 1] += speed * 0.01; // Move up
                 positions[i*3] += Math.sin(time + i) * 0.002; // Swirl X
                 positions[i*3 + 2] += Math.cos(time + i) * 0.002; // Swirl Z

                 // Reset if too high or far
                 if (positions[i*3 + 1] > 1.0 || Math.abs(positions[i*3]) > 0.5) {
                     positions[i*3 + 1] = -0.5;
                     positions[i*3] = (Math.random()-0.5)*0.5;
                     positions[i*3 + 2] = (Math.random()-0.5)*0.5;
                 }
             }
             this.boneFog.geometry.attributes.position.needsUpdate = true;
             this.boneFog.rotation.y = time * 0.2; // Rotate whole fog cluster
         }
     }
     
     // Enchant Animations
     if (this.particles) {
         const positions = this.particles.geometry.attributes.position.array as Float32Array;
         const speed = this.particles.geometry.userData.speed;
         const data = this.particles.geometry.userData.data;
         
         for(let i=0; i < positions.length / 3; i++) {
             positions[i*3 + 1] += speed * 0.01;
             if (positions[i*3 + 1] > 3.5) positions[i*3 + 1] = -1.5;
             
             if (this.activeEnchant === 'golden') {
                 const angle = time * 2 + data[i*3] * 10;
                 const r = 0.2 + Math.sin(time + data[i*3+1]*10)*0.05;
                 positions[i*3] = Math.cos(angle) * r;
                 positions[i*3+2] = Math.sin(angle) * r;
             } else {
                 positions[i*3] += Math.sin(time * 5 + i) * 0.002;
             }
         }
         this.particles.geometry.attributes.position.needsUpdate = true;
     }

     if (this.helix1 && this.helix2) {
         this.helix1.rotation.y = time * 2;
         this.helix2.rotation.y = time * 2 + Math.PI;
         this.helix1.position.y = Math.sin(time) * 0.1;
         this.helix2.position.y = Math.sin(time) * 0.1;
     }

     if (this.rings) {
         this.rings.children.forEach((r, i) => {
             const s = 1.0 + Math.sin(time * 3 + i) * 0.2;
             r.scale.set(s, s, 1);
             r.position.y = (0.5 + i * 1.0) + Math.cos(time * 2 + i) * 0.05;
         });
     }

     this.auraLayers.forEach((layer, i) => {
         layer.rotation.y += 0.01 * (i + 1);
         const pulse = 1.0 + Math.sin(time * 2 + i) * 0.1;
         layer.scale.set(pulse, 1, pulse);
         (layer.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(time * 3 + i)*0.1;
     });
  }
}
