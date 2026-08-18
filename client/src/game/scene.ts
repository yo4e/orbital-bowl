// ORBITAL BOWL scene — Babylon owns the moving world; React only receives the handle and HUD state.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { GameWorld } from "@/game/GameWorld";
import type { GameCallbacks, GameSettings } from "@/game/types";

export interface GameHandle {
  scene: Scene;
  setSettings: (settings: Partial<GameSettings>) => void;
  launch: () => void;
  resetRound: () => void;
  toggleSound: () => void;
  dispose: () => void;
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, callbacks: GameCallbacks): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.012, 0.015, 0.06, 1);
  const camera = new ArcRotateCamera("observatory-camera", -1.94, 1.11, 19.2, new Vector3(0.18, 0.12, 0.08), scene);
  camera.lowerRadiusLimit = 14;
  camera.upperRadiusLimit = 24;
  camera.wheelPrecision = 10000;
  camera.fov = 0.74;

  const hemi = new HemisphericLight("cool-starlight", new Vector3(-0.3, 1, -0.2), scene);
  hemi.diffuse = new Color3(0.55, 0.51, 0.87);
  hemi.groundColor = new Color3(0.09, 0.04, 0.15);
  hemi.intensity = 0.72;
  const warm = new PointLight("quiet-sun", new Vector3(-6, 7, -7), scene);
  warm.diffuse = new Color3(1, 0.72, 0.58);
  warm.intensity = 0.85;
  warm.range = 22;
  const rim = new PointLight("teal-rim", new Vector3(5, 1, 5), scene);
  rim.diffuse = new Color3(0.24, 0.78, 0.75);
  rim.intensity = 0.35;
  rim.range = 16;

  const world = new GameWorld(scene, camera, canvas, callbacks);
  return {
    scene,
    setSettings: (settings) => world.setSettings(settings),
    launch: () => world.launch(),
    resetRound: () => world.resetRound(),
    toggleSound: () => world.toggleSound(),
    dispose: () => { world.dispose(); scene.dispose(); },
  };
}
