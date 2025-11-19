import * as THREE from 'three';
import { BoatType } from '../types';

export class BoatController {
  group: THREE.Group;
  currentType: BoatType | null = null;
  private nightLights: THREE.Object3D[] = [];
  private emissiveMeshes: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 10); 
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }

  update(type: BoatType) {
    if (this.currentType === type) return;
    this.currentType = type;

    // Clear existing
    while(this.group.children.length > 0){ 
        const child = this.group.children[0];
        if (child instanceof THREE.Mesh) {
             child.geometry.dispose();
             if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
             else child.material.dispose();
        }
        this.group.remove(child); 
    }
    this.nightLights = [];
    this.emissiveMeshes = [];

    // Generate new
    const boatMesh = this.generateBoat(type);
    this.group.add(boatMesh);
  }

  setNightMode(isNight: boolean) {
      // Toggle Light Objects
      this.nightLights.forEach(l => l.visible = isNight);

      // Toggle Emissive Materials
      this.emissiveMeshes.forEach(m => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (isNight) {
              mat.emissiveIntensity = 1.0;
          } else {
              mat.emissiveIntensity = 0.0;
          }
      });
  }

  animate(time: number) {
    const yBob = Math.sin(time * 1.5) * 0.15;
    const zRock = Math.cos(time * 0.8) * 0.02; 
    const xRock = Math.sin(time * 0.5) * 0.02; 

    this.group.position.y = yBob - 0.2; 
    this.group.rotation.x = zRock;
    this.group.rotation.z = xRock;

    // Flicker lanterns
    if (this.currentType === 'wooden' && this.nightLights.length > 0 && this.nightLights[0].visible) {
        const flicker = 0.8 + Math.sin(time * 15) * 0.1 + Math.cos(time * 5) * 0.1;
        (this.nightLights[0] as THREE.PointLight).intensity = flicker * 2.0;
    }
  }

  private generateBoat(type: BoatType): THREE.Group {
    const container = new THREE.Group();

    if (type === 'wooden') {
        // === WOODEN ROWBOAT ===
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 1.0 });
        
        // Hull
        const shape = new THREE.Shape();
        shape.moveTo(0, 2.5); 
        shape.quadraticCurveTo(1.2, 1.0, 1.0, -2.0); 
        shape.lineTo(-1.0, -2.0); 
        shape.quadraticCurveTo(-1.2, 1.0, 0, 2.5); 

        const hullGeo = new THREE.ExtrudeGeometry(shape, { steps: 2, depth: 0.8, bevelEnabled: false });
        const hull = new THREE.Mesh(hullGeo, woodMat);
        hull.rotation.x = -Math.PI / 2;
        hull.position.y = 0.5; 
        container.add(hull);

        // Floor
        const floorGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.1;
        container.add(floor);

        // Seats
        const seatGeo = new THREE.BoxGeometry(1.8, 0.1, 0.4);
        const seat1 = new THREE.Mesh(seatGeo, woodMat);
        seat1.position.set(0, 0.6, 0);
        container.add(seat1);
        
        const seat2 = new THREE.Mesh(seatGeo, woodMat);
        seat2.position.set(0, 0.6, -1.0);
        container.add(seat2);

        // NIGHT LIGHT: Lantern on rear seat
        const lanternGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.4);
        const lanternMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(0.5, 0.8, -1.0); // Sitting on rear seat
        container.add(lantern);

        // Lantern Glow
        const glowGeo = new THREE.SphereGeometry(0.08);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 0.1;
        lantern.add(glow);
        this.nightLights.push(glow); // Add mesh to toggle if we want (optional, here we toggle light)

        const light = new THREE.PointLight(0xffaa00, 0, 10); // Start 0 intensity
        light.position.set(0, 0.2, 0);
        lantern.add(light);
        this.nightLights.push(light);

    } else if (type === 'fiberglass') {
        // === SPEEDBOAT ===
        const hullMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3, metalness: 0.1 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 });
        const glassMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x88ccff, transparent: true, opacity: 0.4, roughness: 0, metalness: 0.9, side: THREE.DoubleSide 
        });

        // Hull
        const shape = new THREE.Shape();
        shape.moveTo(0, 3.5);
        shape.lineTo(1.2, 0);
        shape.lineTo(1.2, -2.5);
        shape.lineTo(-1.2, -2.5);
        shape.lineTo(-1.2, 0);
        shape.lineTo(0, 3.5);

        const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1 });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.rotation.x = -Math.PI / 2;
        container.add(hull);

        // Windshield
        const glassPlane = new THREE.PlaneGeometry(2.2, 0.8);
        const glass = new THREE.Mesh(glassPlane, glassMat);
        glass.position.set(0, 1.5, 1.0);
        glass.rotation.x = -Math.PI / 4;
        container.add(glass);

        // Stripe
        const stripeGeo = new THREE.BoxGeometry(2.5, 0.1, 6.0);
        const stripe = new THREE.Mesh(stripeGeo, trimMat);
        stripe.position.set(0, 0.8, 0.5);
        container.add(stripe);

        // NIGHT LIGHTS: Headlights
        const lightCaseGeo = new THREE.ConeGeometry(0.1, 0.2, 16);
        const lightCaseMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        // Left Light
        const lLight = new THREE.Mesh(lightCaseGeo, lightCaseMat);
        lLight.rotation.x = Math.PI / 2;
        lLight.position.set(-0.8, 1.2, 2.8);
        container.add(lLight);
        
        const spotL = new THREE.SpotLight(0xffffff, 0, 30, Math.PI/6, 0.5, 1);
        spotL.position.set(0, 0, 0);
        spotL.target.position.set(0, 0, 5);
        lLight.add(spotL);
        lLight.add(spotL.target);
        this.nightLights.push(spotL);

        // Right Light
        const rLight = new THREE.Mesh(lightCaseGeo, lightCaseMat);
        rLight.rotation.x = Math.PI / 2;
        rLight.position.set(0.8, 1.2, 2.8);
        container.add(rLight);

        const spotR = new THREE.SpotLight(0xffffff, 0, 30, Math.PI/6, 0.5, 1);
        spotR.position.set(0, 0, 0);
        spotR.target.position.set(0, 0, 5);
        rLight.add(spotR);
        rLight.add(spotR.target);
        this.nightLights.push(spotR);

        // Emissive Lens
        const lensGeo = new THREE.CircleGeometry(0.08);
        const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 });
        const lensL = new THREE.Mesh(lensGeo, lensMat.clone());
        lensL.position.set(0, -0.1, 0);
        lensL.rotation.x = Math.PI/2;
        lLight.add(lensL);
        this.emissiveMeshes.push(lensL);

        const lensR = new THREE.Mesh(lensGeo, lensMat.clone());
        lensR.position.set(0, -0.1, 0);
        lensR.rotation.x = Math.PI/2;
        rLight.add(lensR);
        this.emissiveMeshes.push(lensR);

    } else if (type === 'yacht') {
        // === LUXURY YACHT ===
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.1 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.8 });

        // Hull
        const shape = new THREE.Shape();
        shape.moveTo(0, 5.0);
        shape.quadraticCurveTo(2.0, 2.0, 2.0, -4.0);
        shape.lineTo(-2.0, -4.0);
        shape.quadraticCurveTo(-2.0, 2.0, 0, 5.0);

        const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: true, bevelSize: 0.2 });
        const hull = new THREE.Mesh(hullGeo, whiteMat);
        hull.rotation.x = -Math.PI / 2;
        hull.position.y = -0.5;
        container.add(hull);

        // Deck
        const deckGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.rotation.x = -Math.PI / 2;
        deck.position.y = 1.8;
        container.add(deck);

        // Cabin with Windows
        const cabinGeo = new THREE.BoxGeometry(3, 1.5, 4);
        const cabin = new THREE.Mesh(cabinGeo, whiteMat);
        cabin.position.set(0, 2.5, -1.5);
        container.add(cabin);

        // Window Lights (Emissive planes on cabin)
        const winMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffaa00, emissiveIntensity: 0 });
        const winGeo = new THREE.PlaneGeometry(0.8, 0.6);
        
        // Left Windows
        const winL1 = new THREE.Mesh(winGeo, winMat.clone());
        winL1.position.set(-1.51, 0, 0.5);
        winL1.rotation.y = -Math.PI/2;
        cabin.add(winL1);
        this.emissiveMeshes.push(winL1);

        const winL2 = new THREE.Mesh(winGeo, winMat.clone());
        winL2.position.set(-1.51, 0, -0.8);
        winL2.rotation.y = -Math.PI/2;
        cabin.add(winL2);
        this.emissiveMeshes.push(winL2);

        // Right Windows
        const winR1 = new THREE.Mesh(winGeo, winMat.clone());
        winR1.position.set(1.51, 0, 0.5);
        winR1.rotation.y = Math.PI/2;
        cabin.add(winR1);
        this.emissiveMeshes.push(winR1);

        const winR2 = new THREE.Mesh(winGeo, winMat.clone());
        winR2.position.set(1.51, 0, -0.8);
        winR2.rotation.y = Math.PI/2;
        cabin.add(winR2);
        this.emissiveMeshes.push(winR2);
        
        // Deck Ambient Light
        const deckLight = new THREE.PointLight(0xffaa00, 0, 15);
        deckLight.position.set(0, 4, -4);
        container.add(deckLight);
        this.nightLights.push(deckLight);
    }

    // Scale boat to fit scene
    container.scale.setScalar(1.5);
    return container;
  }
}