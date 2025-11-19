import * as THREE from 'three';

export class BobberController {
  group: THREE.Group;
  mesh: THREE.Group; // The physical bobber
  effectsGroup: THREE.Group; // The aura container

  private activeEnchant: string = 'none';
  
  // Effects storage
  private particles: THREE.Points | null = null;
  private rings: THREE.Group | null = null;
  private spinners: THREE.Group | null = null;
  private floaters: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();

    // --- PHYSICAL BOBBER ---
    this.mesh = new THREE.Group();
    
    // Top Half (Red)
    const topGeo = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI*2, 0, Math.PI/2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.3, metalness: 0.2 });
    const topHalf = new THREE.Mesh(topGeo, topMat);
    this.mesh.add(topHalf);

    // Bottom Half (White)
    const botGeo = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
    const botHalf = new THREE.Mesh(botGeo, botMat);
    this.mesh.add(botHalf);

    // Stick/Antenna
    const stickGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.6);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 0.2;
    this.mesh.add(stick);

    // Glow Tip
    const tipGeo = new THREE.SphereGeometry(0.04);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.5;
    this.mesh.add(tip);

    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // --- EFFECTS CONTAINER ---
    this.effectsGroup = new THREE.Group();
    this.group.add(this.effectsGroup);

    this.group.visible = false;
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }
  
  get position() {
    return this.group.position;
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  updateEnchant(enchant: string) {
    if (this.activeEnchant === enchant) return;
    this.activeEnchant = enchant;
    
    this.effectsGroup.clear();
    this.particles = null;
    this.rings = null;
    this.spinners = null;
    this.floaters = [];

    if (enchant === 'none') return;

    switch(enchant) {
        case 'lucky':
            this.createParticles(0x4ade80, 15, 0.5); // Green rising
            this.createSpinningRings(0x4ade80, 1, false);
            break;
        case 'deep':
             this.createRippleEffect();
             this.createParticles(0x00ffff, 10, 0.2);
             break;
        case 'steady':
             this.createGyroScope();
             break;
        case 'golden':
             this.createParticles(0xffd700, 35, 0.8); // Gold dense
             this.createSpinningRings(0xffaa00, 2, true); // Spinning rings
             const halo = this.createSimpleHalo(0xffff00);
             this.effectsGroup.add(halo);
             break;
        case 'ancient':
             this.createMysticVoid();
             break;
    }
  }

  // --- EFFECT GENERATORS ---

  private createParticles(color: number, count: number, spread: number) {
      const geom = new THREE.BufferGeometry();
      const pos = [];
      const speeds = [];
      
      for(let i=0; i<count; i++) {
          const x = (Math.random() - 0.5) * spread;
          const z = (Math.random() - 0.5) * spread;
          const y = Math.random() * 1.0 - 0.5;
          pos.push(x, y, z);
          speeds.push(0.5 + Math.random());
      }
      
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.userData = { speeds };
      
      const mat = new THREE.PointsMaterial({
          color: color,
          size: 0.05,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
      });
      
      this.particles = new THREE.Points(geom, mat);
      this.effectsGroup.add(this.particles);
  }

  private createSpinningRings(color: number, count: number, vertical: boolean) {
      this.rings = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      
      for(let i=0; i<count; i++) {
          const geo = new THREE.TorusGeometry(0.4 + i*0.2, 0.01, 8, 32);
          const mesh = new THREE.Mesh(geo, mat);
          if (!vertical) mesh.rotation.x = Math.PI/2;
          else mesh.rotation.y = (Math.PI/count) * i;
          this.rings.add(mesh);
      }
      this.effectsGroup.add(this.rings);
  }

  private createRippleEffect() {
      // Create 3 flat rings that will scale up
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const geo = new THREE.RingGeometry(0.3, 0.35, 32);
      geo.rotateX(-Math.PI/2);

      for(let i=0; i<3; i++) {
          const mesh = new THREE.Mesh(geo, mat.clone());
          mesh.scale.setScalar(0.1 + i * 0.3); 
          this.effectsGroup.add(mesh);
          this.floaters.push(mesh);
      }
  }

  private createGyroScope() {
      this.spinners = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.4 });
      
      const geo1 = new THREE.IcosahedronGeometry(0.4, 0);
      const mesh1 = new THREE.Mesh(geo1, mat);
      this.spinners.add(mesh1);

      const geo2 = new THREE.TorusGeometry(0.5, 0.01, 8, 32);
      const mesh2 = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 }));
      this.spinners.add(mesh2);
      
      this.effectsGroup.add(this.spinners);
  }

  private createMysticVoid() {
      this.spinners = new THREE.Group();
      
      // Dark core
      const coreGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x220044 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      this.effectsGroup.add(core);

      // Rotating Runes (Torus Knot)
      const knotGeo = new THREE.TorusKnotGeometry(0.4, 0.02, 64, 8);
      const knotMat = new THREE.MeshBasicMaterial({ color: 0x9d46ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
      const knot = new THREE.Mesh(knotGeo, knotMat);
      this.spinners.add(knot);
      
      this.effectsGroup.add(this.spinners);
      this.createParticles(0xff00ff, 25, 0.6);
  }

  private createSimpleHalo(color: number) {
      const geo = new THREE.RingGeometry(0.25, 0.35, 32);
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.lookAt(0, 1, 0);
      return mesh;
  }

  animate(time: number) {
     if (this.particles) {
         const positions = this.particles.geometry.attributes.position.array as Float32Array;
         const speeds = this.particles.geometry.userData.speeds;
         for(let i=0; i<positions.length/3; i++) {
             positions[i*3 + 1] += speeds[i] * 0.01; 
             if (positions[i*3 + 1] > 1.0) {
                 positions[i*3 + 1] = -0.5;
                 positions[i*3] = (Math.random() - 0.5) * 0.5;
                 positions[i*3+2] = (Math.random() - 0.5) * 0.5;
             }
         }
         this.particles.geometry.attributes.position.needsUpdate = true;
     }

     if (this.rings) {
         this.rings.rotation.y = time * 0.8;
         this.rings.rotation.x = Math.sin(time) * 0.2;
     }

     if (this.spinners) {
         this.spinners.rotation.x = time;
         this.spinners.rotation.z = time * 0.7;
         const s = 1.0 + Math.sin(time * 4) * 0.05;
         this.spinners.scale.setScalar(s);
     }

     // Handle "Deep" Ripples
     if (this.activeEnchant === 'deep') {
         this.floaters.forEach((mesh, i) => {
             let s = mesh.scale.x + 0.01;
             if (s > 2.5) s = 0.2;
             mesh.scale.set(s, s, 1); 
             
             const opacity = Math.max(0, 1.0 - (s / 2.5));
             (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
         });
     }
  }
}