// ORBITAL BOWL game world — low-poly cosmic garden, readable orbital simulation, and bowling rules.
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Soundscape } from "@/game/Soundscape";
import type { GameCallbacks, GameHudState, GamePhase, GameSettings, StoredProgress } from "@/game/types";

interface Pin {
  root: Mesh;
  body: Mesh;
  standing: boolean;
  fallAmount: number;
  fallAxis: Vector3;
}

const START = new Vector3(-4.35, 0.45, -3.45);
const ASTEROID_RADIUS = 3.9;
const BALL_RADIUS = 0.24;
const PHYSICS_STEP = 1 / 52;
const STORAGE_KEY = "orbital-bowl-progress-v1";
const GOLD = new Color3(0.95, 0.76, 0.44);
const VIOLET = new Color3(0.79, 0.66, 0.84);

interface DifficultyProfile {
  label: "GUIDED" | "CALIBRATED" | "PRECISION";
  hitRadius: number;
  hint: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadProgress(): StoredProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { highScore: 0, bestStrikeStreak: 0, soundEnabled: true };
    return { highScore: 0, bestStrikeStreak: 0, soundEnabled: true, ...JSON.parse(raw) };
  } catch {
    return { highScore: 0, bestStrikeStreak: 0, soundEnabled: true };
  }
}

export class GameWorld {
  private readonly pins: Pin[] = [];
  private readonly ball: Mesh;
  private readonly trail: LinesMesh;
  private readonly preview: LinesMesh;
  private readonly asteroid: Mesh;
  private readonly glow: GlowLayer;
  private readonly stars: Mesh[] = [];
  private settings: GameSettings = { angle: 0, velocity: 4.76, gravity: 1 };
  private phase: GamePhase = "aim";
  private ballVelocity = Vector3.Zero();
  private trailPoints: Vector3[] = [];
  private score = 0;
  private throwNumber = 1;
  private pinsAtLaunch = 10;
  private pinsFelledThisThrow = 0;
  private flightTime = 0;
  private physicsAccumulator = 0;
  private resultTimer = 0;
  private status = "軌道を調律する";
  private inputCleanup: (() => void) | null = null;
  private updateObserver: ReturnType<Scene["onBeforeRenderObservable"]["add"]> | null = null;
  private progress = loadProgress();
  private sound = new Soundscape();
  private demo: boolean;

  constructor(
    private readonly scene: Scene,
    private readonly camera: ArcRotateCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: GameCallbacks,
  ) {
    this.demo = new URLSearchParams(window.location.search).has("demo");
    this.sound.enabled = this.progress.soundEnabled;
    this.glow = new GlowLayer("quiet-glow", scene, { blurKernelSize: 32 });
    this.glow.intensity = 0.4;
    this.asteroid = this.createAsteroid();
    this.createArchitecture();
    this.createStars();
    this.ball = this.createBall();
    this.trail = MeshBuilder.CreateLines("orbital-trail", { points: [START, START.add(new Vector3(0.001, 0, 0))], updatable: true }, scene);
    this.trail.color = new Color3(1, 0.76, 0.84);
    this.trail.isVisible = false;
    this.preview = MeshBuilder.CreateDashedLines("trajectory-preview", { points: [START, START.add(new Vector3(0.001, 0, 0))], dashNb: 80, updatable: true }, scene);
    this.preview.color = GOLD;
    this.createPins();
    this.bindInputs();
    this.refreshPreview();
    this.emitHud();
    this.updateObserver = scene.onBeforeRenderObservable.add(() => this.update());
    if (this.demo) window.setTimeout(() => this.launch(true), 900);
  }

  setSettings(next: Partial<GameSettings>) {
    if (this.phase !== "aim") return;
    this.settings = {
      angle: clamp(next.angle ?? this.settings.angle, -28, 28),
      velocity: clamp(next.velocity ?? this.settings.velocity, 4.35, 6.8),
      gravity: clamp(next.gravity ?? this.settings.gravity, 0.72, 1.35),
    };
    this.refreshPreview();
    this.emitHud();
  }

  launch(fromDemo = false) {
    if (this.phase !== "aim") return;
    if (!fromDemo) this.sound.unlock();
    const difficulty = this.getDifficulty();
    this.phase = "flight";
    this.pinsAtLaunch = this.pins.filter((pin) => pin.standing).length;
    this.pinsFelledThisThrow = 0;
    this.status = difficulty.label === "GUIDED" ? "GUIDED ORBIT — 最初のピン列を捕捉中" : "軌道を見守る";
    this.flightTime = 0;
    this.physicsAccumulator = 0;
    this.ball.position.copyFrom(START);
    this.ball.isVisible = true;
    this.trailPoints = [START.clone()];
    this.trail.isVisible = true;
    const radial = START.clone().normalize();
    const tangent = Vector3.Cross(radial, Vector3.Up()).normalize();
    const lift = Math.sin((this.settings.angle * Math.PI) / 180) * 1.05;
    this.ballVelocity = tangent.scale(this.settings.velocity).add(new Vector3(0, lift, 0));
    this.sound.launch();
    this.emitHud();
  }

  resetRound() {
    this.phase = "aim";
    this.settings = { angle: 0, velocity: 4.76, gravity: 1 };
    this.score = 0;
    this.throwNumber = 1;
    this.pinsAtLaunch = 10;
    this.pinsFelledThisThrow = 0;
    this.flightTime = 0;
    this.physicsAccumulator = 0;
    this.status = "新しい軌道を描く";
    this.ball.position.copyFrom(START);
    this.ball.isVisible = true;
    this.trail.isVisible = false;
    this.trailPoints = [];
    for (const pin of this.pins) {
      pin.standing = true;
      pin.fallAmount = 0;
      pin.body.rotation = Vector3.Zero();
    }
    this.refreshPreview();
    this.emitHud();
  }

  toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.progress.soundEnabled = this.sound.enabled;
    this.saveProgress();
    this.emitHud();
  }

  dispose() {
    this.inputCleanup?.();
    if (this.updateObserver) this.scene.onBeforeRenderObservable.remove(this.updateObserver);
    this.glow.dispose();
  }

  private createAsteroid() {
    const asteroid = MeshBuilder.CreateIcoSphere("lavender-asteroid", { radius: ASTEROID_RADIUS, subdivisions: 3, flat: true }, this.scene);
    const material = new StandardMaterial("asteroid-mineral", this.scene);
    material.diffuseColor = new Color3(0.63, 0.47, 0.68);
    material.specularColor = new Color3(0.12, 0.08, 0.17);
    asteroid.material = material;
    asteroid.rotation = new Vector3(0.12, -0.36, 0.08);
    return asteroid;
  }

  private createBall() {
    const ball = MeshBuilder.CreateSphere("pearl-ball", { diameter: BALL_RADIUS * 2, segments: 20 }, this.scene);
    const material = new StandardMaterial("ball-pearl", this.scene);
    material.diffuseColor = new Color3(0.97, 0.89, 0.82);
    material.emissiveColor = new Color3(0.15, 0.06, 0.13);
    material.specularColor = Color3.White();
    material.specularPower = 80;
    ball.material = material;
    ball.position.copyFrom(START);
    return ball;
  }

  private createArchitecture() {
    const stone = new StandardMaterial("architecture-stone", this.scene);
    stone.diffuseColor = new Color3(0.92, 0.78, 0.71);
    stone.emissiveColor = new Color3(0.05, 0.02, 0.06);
    const lavender = new StandardMaterial("architecture-lavender", this.scene);
    lavender.diffuseColor = VIOLET;
    lavender.emissiveColor = new Color3(0.04, 0.02, 0.07);

    const ringA = MeshBuilder.CreateTorus("halo-major", { diameter: 11.2, thickness: 0.035, tessellation: 72 }, this.scene);
    ringA.rotation = new Vector3(1.14, 0.25, -0.42);
    const ringMaterial = new StandardMaterial("halo-gold", this.scene);
    ringMaterial.emissiveColor = new Color3(0.65, 0.47, 0.2);
    ringMaterial.alpha = 0.52;
    ringA.material = ringMaterial;

    const ringB = MeshBuilder.CreateTorus("halo-small", { diameter: 8.9, thickness: 0.022, tessellation: 72 }, this.scene);
    ringB.rotation = new Vector3(1.39, -0.48, 0.18);
    const violetRing = new StandardMaterial("halo-violet", this.scene);
    violetRing.emissiveColor = new Color3(0.47, 0.25, 0.6);
    violetRing.alpha = 0.38;
    ringB.material = violetRing;

    for (let index = 0; index < 5; index += 1) {
      const angle = -0.3 + index * 0.25;
      const radius = 3.55;
      const column = MeshBuilder.CreateCylinder(`column-${index}`, { height: 1.2 + (index % 2) * 0.35, diameterTop: 0.12, diameterBottom: 0.22, tessellation: 5 }, this.scene);
      column.position = new Vector3(Math.cos(angle) * radius, 2.65 + (index % 2) * 0.18, Math.sin(angle) * radius - 0.25);
      column.rotation.z = 0.23;
      column.material = index % 2 ? stone : lavender;
    }

    const arch = MeshBuilder.CreateTorus("quiet-arch", { diameter: 1.65, thickness: 0.17, tessellation: 16 }, this.scene);
    arch.position = new Vector3(-1.85, 3.05, 0.65);
    arch.rotation = new Vector3(Math.PI / 2, 0.3, 0);
    arch.material = stone;
    for (let index = 0; index < 4; index += 1) {
      const step = MeshBuilder.CreateBox(`step-${index}`, { width: 1.5 - index * 0.13, height: 0.18, depth: 0.45 }, this.scene);
      step.position = new Vector3(-1.9 + index * 0.14, 2.05 + index * 0.17, 1.25 + index * 0.1);
      step.rotation.y = -0.33;
      step.material = stone;
    }
  }

  private createStars() {
    const starMaterial = new StandardMaterial("stars-material", this.scene);
    starMaterial.emissiveColor = new Color3(0.76, 0.76, 1);
    starMaterial.disableLighting = true;
    for (let index = 0; index < 82; index += 1) {
      const theta = ((index * 137.5) % 360) * (Math.PI / 180);
      const y = ((index * 47) % 17) - 8;
      const distance = 24 + (index % 8) * 1.8;
      const star = MeshBuilder.CreateSphere(`star-${index}`, { diameter: index % 11 === 0 ? 0.09 : 0.035, segments: 4 }, this.scene);
      star.position = new Vector3(Math.cos(theta) * distance, y, Math.sin(theta) * distance);
      star.material = starMaterial;
      this.stars.push(star);
    }
  }

  private createPins() {
    const pinMaterial = new StandardMaterial("pin-ivory", this.scene);
    pinMaterial.diffuseColor = new Color3(0.98, 0.91, 0.81);
    pinMaterial.specularColor = Color3.White();
    const stripeMaterial = new StandardMaterial("pin-stripe", this.scene);
    stripeMaterial.emissiveColor = new Color3(0.56, 0.16, 0.36);
    const target = new Vector3(3.0, -0.28, 3.05);
    const rows = [1, 2, 3, 4];
    let pinIndex = 0;
    rows.forEach((count, row) => {
      for (let col = 0; col < count; col += 1) {
        const root = MeshBuilder.CreateBox(`pin-root-${pinIndex}`, { size: 0.01 }, this.scene);
        root.isVisible = false;
        root.position = target.add(new Vector3((col - (count - 1) / 2) * 0.47, 0.02 + row * 0.13, row * 0.38));
        root.rotation.y = -0.4;
        const body = MeshBuilder.CreateCylinder(`pin-body-${pinIndex}`, { height: 0.72, diameterTop: 0.17, diameterBottom: 0.31, tessellation: 10 }, this.scene);
        body.parent = root;
        body.position.y = 0.36;
        body.material = pinMaterial;
        const head = MeshBuilder.CreateSphere(`pin-head-${pinIndex}`, { diameter: 0.26, segments: 10 }, this.scene);
        head.parent = root;
        head.position.y = 0.7;
        head.material = pinMaterial;
        for (const offset of [0.51, 0.58]) {
          const stripe = MeshBuilder.CreateTorus(`pin-stripe-${pinIndex}-${offset}`, { diameter: 0.205, thickness: 0.026, tessellation: 12 }, this.scene);
          stripe.parent = root;
          stripe.position.y = offset;
          stripe.rotation.x = Math.PI / 2;
          stripe.material = stripeMaterial;
        }
        this.pins.push({ root, body, standing: true, fallAmount: 0, fallAxis: new Vector3(0.65, 0, 0.25).normalize() });
        pinIndex += 1;
      }
    });
  }

  private bindInputs() {
    let pointerDown = false;
    let pointerX = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (this.phase !== "aim") return;
      pointerDown = true;
      pointerX = event.clientX;
      this.canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown || this.phase !== "aim") return;
      const delta = event.clientX - pointerX;
      pointerX = event.clientX;
      this.setSettings({ angle: this.settings.angle + delta * 0.16 });
    };
    const onPointerUp = (event: PointerEvent) => {
      pointerDown = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      if (this.phase !== "aim") return;
      event.preventDefault();
      this.setSettings({ velocity: this.settings.velocity - event.deltaY * 0.003 });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.code === "Space") { event.preventDefault(); this.launch(); }
      if (event.key.toLowerCase() === "r") this.resetRound();
      if (event.key.toLowerCase() === "m") this.toggleSound();
      if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
    };
    this.canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    this.inputCleanup = () => {
      this.canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      this.canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }

  private refreshPreview() {
    const points = this.simulatePath();
    MeshBuilder.CreateDashedLines("trajectory-preview", { points, instance: this.preview }, this.scene);
  }

  private simulatePath() {
    const points: Vector3[] = [];
    let position = START.clone();
    const radial = START.clone().normalize();
    let velocity = Vector3.Cross(radial, Vector3.Up()).normalize().scale(this.settings.velocity);
    velocity.y += Math.sin((this.settings.angle * Math.PI) / 180) * 1.05;
    for (let index = 0; index < 230; index += 1) {
      points.push(position.clone());
      const distance = position.length();
      const acceleration = position.clone().normalize().scale(-145 * this.settings.gravity / Math.max(distance * distance, 1));
      velocity = velocity.add(acceleration.scale(PHYSICS_STEP));
      position = position.add(velocity.scale(PHYSICS_STEP));
      if (distance < ASTEROID_RADIUS + BALL_RADIUS + 0.18 || distance > 19) break;
    }
    return points;
  }

  private update() {
    const delta = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.033);
    const drift = this.scene.getAnimationRatio() * 0.0015;
    this.stars.forEach((star, index) => { star.position.y += Math.sin(performance.now() * 0.0004 + index) * drift; });
    this.asteroid.rotation.y += delta * 0.018;
    if (this.phase === "flight") this.updateFlight(delta);
    if (this.phase === "result") {
      this.resultTimer -= delta;
      if (this.resultTimer <= 0) this.advanceRound();
    }
    for (const pin of this.pins) {
      if (!pin.standing) {
        pin.fallAmount = Math.min(Math.PI * 0.48, pin.fallAmount + delta * 2.5);
        pin.body.rotation.z = pin.fallAmount * (pin.fallAxis.x >= 0 ? 1 : -1);
      }
    }
  }

  private updateFlight(delta: number) {
    this.physicsAccumulator = Math.min(this.physicsAccumulator + delta, PHYSICS_STEP * 5);
    let stepCount = 0;
    while (this.physicsAccumulator >= PHYSICS_STEP && this.phase === "flight" && stepCount < 5) {
      this.integrateFlightStep(PHYSICS_STEP);
      this.physicsAccumulator -= PHYSICS_STEP;
      stepCount += 1;
    }
  }

  private integrateFlightStep(delta: number) {
    this.flightTime += delta;
    const distance = this.ball.position.length();
    const normal = this.ball.position.clone().normalize();
    const acceleration = normal.scale(-145 * this.settings.gravity / Math.max(distance * distance, 1));
    this.ballVelocity = this.ballVelocity.add(acceleration.scale(delta));
    this.ball.position.addInPlace(this.ballVelocity.scale(delta));
    this.ball.rotation.x += this.ballVelocity.length() * delta * 2.2;
    const floorDistance = ASTEROID_RADIUS + BALL_RADIUS + 0.1;
    if (this.ball.position.length() < floorDistance) {
      const surfaceNormal = this.ball.position.clone().normalize();
      this.ball.position.copyFrom(surfaceNormal.scale(floorDistance));
      const radialSpeed = Vector3.Dot(this.ballVelocity, surfaceNormal);
      this.ballVelocity = this.ballVelocity.subtract(surfaceNormal.scale(radialSpeed * 1.7)).scale(0.76);
    }
    if (this.trailPoints.length === 0 || Vector3.Distance(this.trailPoints[this.trailPoints.length - 1], this.ball.position) > 0.09) {
      this.trailPoints.push(this.ball.position.clone());
      if (this.trailPoints.length > 90) this.trailPoints.shift();
      MeshBuilder.CreateLines("orbital-trail", { points: this.trailPoints, instance: this.trail }, this.scene);
    }
    for (const pin of this.pins) {
      if (!pin.standing) continue;
      const distanceToPin = Vector3.Distance(this.ball.position, pin.root.position.add(new Vector3(0, 0.34, 0)));
      if (distanceToPin < this.getDifficulty().hitRadius) this.knockPin(pin, this.ball.position.subtract(pin.root.position));
    }
    if (this.flightTime > 9.5 || this.ball.position.length() > 22 || this.ballVelocity.length() < 0.15) this.finishThrow();
  }

  private knockPin(pin: Pin, hitDirection: Vector3) {
    pin.standing = false;
    pin.fallAxis = hitDirection.normalize();
    this.score += 100;
    this.pinsFelledThisThrow = this.pinsAtLaunch - this.pins.filter((item) => item.standing).length;
    this.status = `${this.pinsFelledThisThrow} PIN${this.pinsFelledThisThrow > 1 ? "S" : ""} DOWN — 遠くで光がほどける`;
    this.sound.hit();
    const flash = MeshBuilder.CreateSphere(`pin-flash-${performance.now()}`, { diameter: 0.38, segments: 6 }, this.scene);
    flash.position.copyFrom(pin.root.position.add(new Vector3(0, 0.42, 0)));
    const material = new StandardMaterial(`flash-mat-${performance.now()}`, this.scene);
    material.emissiveColor = GOLD;
    material.alpha = 0.75;
    flash.material = material;
    window.setTimeout(() => flash.dispose(), 220);
    if (this.pins.every((item) => !item.standing)) {
      this.score += 500;
      this.status = "STRIKE — 星が呼応する";
      this.glow.intensity = 1.05;
      this.sound.strike();
      window.setTimeout(() => { this.glow.intensity = 0.4; }, 800);
      this.finishThrow(1.35);
    }
    this.emitHud();
  }

  private finishThrow(delay = 1.65) {
    if (this.phase !== "flight") return;
    this.phase = "result";
    this.resultTimer = Math.max(delay, 2.7);
    this.pinsFelledThisThrow = this.pinsAtLaunch - this.pins.filter((pin) => pin.standing).length;
    if (this.pins.every((pin) => !pin.standing)) this.status = "STRIKE — すべてのピンが静かに倒れた";
    else if (this.pinsFelledThisThrow > 0) this.status = `${this.pinsFelledThisThrow} PINS DOWN — 次は少し精密に`;
    else this.status = "NO HIT — VELOCITYを少し上げてみる";
    this.emitHud();
  }

  private advanceRound() {
    this.ball.isVisible = false;
    this.trail.isVisible = false;
    const cleared = this.pins.every((pin) => !pin.standing);
    if (cleared || this.throwNumber >= 3) {
      this.phase = "complete";
      this.status = cleared ? "ONE PLANET COMPLETE" : "この惑星の観測を終える";
      this.progress.highScore = Math.max(this.progress.highScore, this.score);
      if (cleared) this.progress.bestStrikeStreak += 1;
      this.saveProgress();
      this.emitHud();
      if (this.demo) window.setTimeout(() => { this.resetRound(); this.launch(true); }, 1600);
      return;
    }
    this.throwNumber += 1;
    this.phase = "aim";
    this.status = this.pinsFelledThisThrow > 0 ? `${this.getDifficulty().label} — 次の軌道を微調整する` : "VELOCITYを少し上げて、もう一度試す";
    this.ball.position.copyFrom(START);
    this.ball.isVisible = true;
    this.refreshPreview();
    this.emitHud();
    if (this.demo) window.setTimeout(() => this.launch(true), 900);
  }

  private emitHud() {
    const difficulty = this.getDifficulty();
    const state: GameHudState = {
      ...this.settings,
      phase: this.phase,
      throwNumber: this.throwNumber,
      pinsStanding: this.pins.filter((pin) => pin.standing).length,
      pinsFelledThisThrow: this.pinsFelledThisThrow,
      difficultyLabel: difficulty.label,
      difficultyHint: difficulty.hint,
      score: this.score,
      bestScore: this.progress.highScore,
      soundEnabled: this.sound.enabled,
      status: this.status,
      launchReady: this.phase === "aim",
    };
    this.callbacks.onHudChange(state);
  }

  private getDifficulty(): DifficultyProfile {
    if (this.throwNumber === 1 && this.score === 0) {
      return { label: "GUIDED", hitRadius: 0.94, hint: "初回は広い軌道補正。近いピンをつかまえます。" };
    }
    if (this.throwNumber === 2) {
      return { label: "CALIBRATED", hitRadius: 0.78, hint: "補正は控えめ。ANGLEで列を選びましょう。" };
    }
    return { label: "PRECISION", hitRadius: 0.64, hint: "最後は精密軌道。VELOCITYも試してみましょう。" };
  }

  private saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress)); } catch { /* local play remains available */ }
  }
}
