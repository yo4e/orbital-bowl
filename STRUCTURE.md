# ORBITAL BOWL

## Runtime

| 項目 | 内容 |
|---|---|
| Renderer | Babylon.js 9.21.2 |
| Host | React 19 + TypeScript + Vite |
| Dimension | 3D |
| Browser entry | WebDev Preview root `/` |

## App Entry

`client/src/App.tsx` は全画面の `GameCanvas` のみを描画する。`GameCanvas.tsx` はBabylon Engineの開始・破棄・リサイズとDOM HUDの橋渡しを担当し、ゲームルールは持たない。`client/src/game/scene.ts` はシーンと `GameWorld` を生成し、Reactへ渡す `GameHandle` を返す。

## Game Modules

| Module | Responsibility |
|---|---|
| `GameWorld.ts` | 小惑星、ボール、ピン、建築、重力積分、衝突判定、投球状態、入力、スコアリング |
| `scene.ts` | Babylon Scene、カメラ、照明、背景レイヤー、`GameHandle`の生成 |
| `assets.ts` | WebDev永続URLのアセット定義 |
| `types.ts` | UIとゲームの間で共有する設定値・表示状態の型 |
| `GameCanvas.tsx` | Canvasライフサイクル、HUD、設定入力、画面向き案内 |

## Assets

| Asset | Intended size | Runtime role |
|---|---|---|
| 星雲背景 | 1920×1080相当、全画面 | Babylon `Layer`の背景 |
| 小惑星テクスチャ | 2m相当の見え方 | 低ポリIcoSphereの拡散テクスチャ |
| 軌道ロゴ | 44×44px | 左上のブランド記号 |
| 手続きメッシュ | 小惑星半径3.9m、ピン高さ0.72m | ゲームの操作対象と環境 |

## Verification

`pnpm check` と `pnpm build` を通し、通常画面と `?demo` をスクリーンショットで確認する。ドラッグ・ホイール・各スライダー・発射・リセット・ショートカット・ローカル記録が、ゲームの状態を直接更新することを確認する。
