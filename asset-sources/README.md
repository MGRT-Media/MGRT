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
