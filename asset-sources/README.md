# Asset sources

The full-resolution originals the shipped assets are derived from.

`public/models/*.glb` are **boot** builds: the same geometry, hierarchy, UVs,
transforms and materials as the files here, with their embedded textures
reduced to 256px (and removed entirely from `digital-stone.glb`, whose material
and UVs are replaced at runtime — see `Monitor.jsx`'s `useStonePedestal`). The
full-resolution textures are extracted beside them under `textures/` and loaded
after the opening is on screen (`propTextureUpgrades.js`).

Nothing here is served. Regenerate the shipped files with:

    npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
    node scripts/build-prop-assets.mjs

The packages are installed with `--no-save` on purpose: this pipeline runs when
an artist replaces a model, not on every build, and it does not belong in the
application's dependency tree.


## Creative Table studio (`studio/`)

Sources for the Creative Table scene's shipped assets. All are free to use and
redistribute; none needs attribution in the product, but the sources are
recorded here.

| Source | What | Author | Licence | From |
|---|---|---|---|---|
| `studio/plaster_grey_04/` | Plaster Grey 04, 2K colour, OpenGL normal and roughness | Rob Tuytel | CC0 1.0 | https://polyhaven.com/a/plaster_grey_04 |
| `studio/european_walnut_veneer_05/` | European Walnut Veneer 05, 2K colour, OpenGL normal and roughness | Jenelle van Heerden | CC0 1.0 | https://polyhaven.com/a/european_walnut_veneer_05 |
| `studio/grey_cartago_03/` | Grey Cartago 03, 2K colour, OpenGL normal, roughness and AO. Downloaded 2026-10-22 for the stone table; **not shipped** — the scan is a mosaic of small tiles (see `docs/build-status.md`) | Lucas Sánchez Ros | CC0 1.0 | https://polyhaven.com/a/grey_cartago_03 |
| `studio/marble_024/` | Marble 024, 2K colour, OpenGL normal and roughness (the stone tabletop) | ambientCG; listed as a generated material | CC0 1.0 | https://ambientcg.com/view?id=Marble024 |
| `studio/Cormorant.ttf` | Cormorant, variable font (weight axis 300 to 700) | The Cormorant Project Authors | SIL Open Font License 1.1, `studio/Cormorant-OFL.txt` | github.com/CatharsisFonts/Cormorant |
| `studio/wordmark-outlines.json` | Outlines of the letters M G R T E D I A at weight 500, derived from `Cormorant.ttf` | derived | SIL Open Font License 1.1 | `scripts/extract-wordmark-outlines.swift` |

Each texture directory's `info.json` is Poly Haven's own metadata for the scan.

### What ships, and how to rebuild it

**Textures** — `public/textures/studio/plaster/`, `public/textures/studio/stone/` and `public/textures/studio/walnut/` (kept, not currently loaded),
each `albedo.webp`, `normal.webp` and `orm.webp`:

    npm i --no-save sharp
    node scripts/build-studio-textures.mjs

The scans have no occlusion map, so `orm.webp` is the roughness map in the
green channel with red white and blue black. Plaster ships at 1024 / 768 / 512
(colour / normal / roughness); walnut at 2048 / 1024 / 1024. The walnut scan is
a pale, nearly neutral veneer: the script widens its contrast by 2.2 so the
grain survives the dark tint the material applies at runtime. The stone ships
at 2048 / 1024 / 1024; its polished roughness is re-centred to a honed 0.62,
its contrast widened 2.4× and its saturation halved.

**Wall lettering** — `public/models/studio/wall-lettering.glb`:

    swift scripts/extract-wordmark-outlines.swift asset-sources/studio/Cormorant.ttf \
      > asset-sources/studio/wordmark-outlines.json
    node scripts/build-wall-lettering.mjs

The first step needs macOS (it uses CoreText) and only has to be re-run if the
font changes. Cormorant is a variable font whose default instance is Light
(300); the script asks for weight 500 explicitly and stops if it was not
applied. The outlines it writes are committed, so the second step runs
anywhere. That step sets the two lines from `LETTERING` in
`src/experience/studio/studioLayout.js`, extrudes them to its depth with a
1.4 mm chamfer, and writes a geometry-only GLB (22,912 vertices, 17,840
triangles, 475 kB). It uses only `three`.

The floor uses the original scene's `textures/floors` set, already in `public/`.
