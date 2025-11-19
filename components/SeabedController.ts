
import * as THREE from 'three';

export class SeabedController {
  group: THREE.Group;
  private crystals: THREE.Mesh[] = [];
  private kelp: THREE.Group[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.initSeabed();
    this.initRuins();
    this.initVegetation();
  }

  private initSeabed() {
    // Large Sandy Bottom
    const geo = new THREE.PlaneGeometry(2000, 2000, 32, 32);
    
    // Add some noise to vertices for uneven terrain
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Z is height in PlaneGeometry before rotation
        const z = Math.sin(x * 0.05) * 2 + Math.cos(y * 0.05) * 2; 
        pos.setZ(i, z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ 
        color: 0xe6c288, // Sand color
        roughness: 1.0,
        side: THREE.DoubleSide
    });

    const seabed = new THREE.Mesh(geo, mat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -25; // 25 units below surface
    seabed.receiveShadow = true;
    this.group.add(seabed);
  }

  private initRuins() {
    const stoneMat = new THREE.MeshStandardMaterial({ 
        color: 0x8899a6, 
        roughness: 0.8,
        flatShading: true 
    });
    
    const crystalMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.8 
    });

    // 1. Generate Circle of Pillars (Some broken, some tall)
    const pillarCount = 12;
    const radius = 60;

    for(let i=0; i<pillarCount; i++) {
        const angle = (i / pillarCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius - 20; // Offset forward

        // Randomize pillar type
        const isTall = Math.random() > 0.5;
        const height = isTall ? 35 : 15; // Tall breaches surface, short stays under
        
        const pillarGroup = new THREE.Group();
        pillarGroup.position.set(x, -25, z);

        // Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), stoneMat);
        pillarGroup.add(base);

        // Column
        const colGeo = new THREE.CylinderGeometry(1.2, 1.2, height, 8);
        const col = new THREE.Mesh(colGeo, stoneMat);
        col.position.y = height / 2 + 1;
        pillarGroup.add(col);

        // Capital (Top)
        if (isTall) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), stoneMat);
            cap.position.y = height + 1;
            pillarGroup.add(cap);
            
            // Add glowing crystal on top of some pillars
            if (Math.random() > 0.3) {
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), crystalMat);
                crystal.position.y = height + 3;
                this.crystals.push(crystal);
                pillarGroup.add(crystal);

                const light = new THREE.PointLight(0x00ffff, 1, 30);
                light.position.y = height + 3;
                pillarGroup.add(light);
            }
        } else {
            // Broken effect
            col.rotation.z = (Math.random() - 0.5) * 0.2;
            col.rotation.x = (Math.random() - 0.5) * 0.2;
        }

        this.group.add(pillarGroup);
    }

    // 2. Sunken Archway (Distant)
    const archGroup = new THREE.Group();
    archGroup.position.set(0, -25, -90); // Far ahead
    
    const colL = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 40, 8), stoneMat);
    colL.position.set(-15, 20, 0);
    const colR = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 40, 8), stoneMat);
    colR.position.set(15, 20, 0);
    
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 4), stoneMat);
    topBeam.position.set(0, 40, 0); // Breaches surface high up

    archGroup.add(colL, colR, topBeam);
    
    // Add large crystal in center of arch
    const giantCrystal = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 0), crystalMat);
    giantCrystal.position.set(0, 30, 0);
    this.crystals.push(giantCrystal);
    archGroup.add(giantCrystal);

    // Floating debris
    for(let i=0; i<10; i++) {
        const debris = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), stoneMat);
        debris.position.set((Math.random()-0.5)*30, Math.random()*10, (Math.random()-0.5)*10);
        debris.rotation.set(Math.random(), Math.random(), Math.random());
        archGroup.add(debris);
    }

    this.group.add(archGroup);
  }

  private initVegetation() {
      const kelpMat = new THREE.MeshStandardMaterial({ 
          color: 0x228b22, 
          side: THREE.DoubleSide,
          flatShading: true
      });

      for(let i=0; i<40; i++) {
          const height = 10 + Math.random() * 15;
          const geo = new THREE.PlaneGeometry(2, height, 1, 4);
          
          // Twist the kelp
          const pos = geo.attributes.position;
          for(let v=0; v < pos.count; v++) {
              const y = pos.getY(v);
              const angle = (y / height) * Math.PI;
              const x = pos.getX(v);
              const z = pos.getZ(v);
              
              const cx = x * Math.cos(angle) - z * Math.sin(angle);
              const cz = x * Math.sin(angle) + z * Math.cos(angle);
              
              pos.setXYZ(v, cx, y + height/2, cz); // pivot bottom
          }
          geo.computeVertexNormals();

          const kelp = new THREE.Mesh(geo, kelpMat);
          const x = (Math.random() - 0.5) * 150;
          const z = (Math.random() - 0.5) * 150 - 20;
          
          kelp.position.set(x, -25, z);
          kelp.userData = { phase: Math.random() * Math.PI * 2 };
          
          const wrapper = new THREE.Group();
          wrapper.add(kelp);
          this.group.add(wrapper);
          this.kelp.push(wrapper);
      }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  animate(time: number) {
      // Pulse Crystals
      this.crystals.forEach((c, i) => {
          const s = 1.0 + Math.sin(time * 2 + i) * 0.1;
          c.scale.setScalar(s);
          c.rotation.y = time * 0.5;
      });

      // Sway Kelp
      this.kelp.forEach((k, i) => {
          const mesh = k.children[0];
          const skew = Math.sin(time + k.children[0].userData.phase) * 0.2;
          mesh.rotation.z = skew * 0.5;
          mesh.rotation.x = Math.cos(time * 0.8 + i) * 0.1;
      });
  }
}