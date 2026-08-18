# Assets

**Art direction:** 深い青墨の宇宙を背景に、月明かりのラベンダー色をした低ポリ小惑星と、淡い金の軌道線を置く。抽象建築は石と夢の中間のように柔らかく、UIは透明な観測ガラスと短い罫線で構成する。鮮やかさよりも、静謐さ・余白・視認性を優先する。

| Asset | Role | Source URL | Use |
|---|---|---|---|
| Visual target | 実装時の画角、密度、HUD配置のQA基準 | `/manus-storage/orbital-bowl-visual-target_2501e0e1.png` | 参照のみ |
| Nebula background | 3Dシーンの背面に置く宇宙背景 | `/manus-storage/orbital-bowl-nebula-background_ab0c1efb.png` | Babylonレイヤー用テクスチャ |
| Asteroid texture | 小惑星の柔らかな鉱物感 | `/manus-storage/orbital-bowl-asteroid-texture_2266c59c.png` | 小惑星マテリアル用テクスチャ |
| Orbital mark | タイトル、情報パネル、ファビコンに使うブランド記号 | `/manus-storage/orbital-bowl-logo_2eca62e8.png` | HTML HUDの画像 |

## Procedural assets

- 小惑星：低分割の球体を頂点ごとにわずかに変形し、生成テクスチャと柔らかな2色照明で表現する。
- 建築：アーチ、柱、階段、環をBox・Cylinder・Torusで構成する。
- ピン：細い胴、丸い頭、赤紫の輪を複数プリミティブで組む。
- 軌道：予測用の破線と、発射後の半透明実線を別々の色・太さで描く。
