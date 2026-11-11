# Field Notes host page

An ordinary weekend newsletter with a small interactive puzzle and a decorative
background. This page has no bundler, workspace link, or source imports. Its
`file:` dependency installs the actual packed npm artifact; the import map loads
the installed ESM file directly.

From the repository root:

```sh
bun install --frozen-lockfile
bun run example:pack
python3 -m http.server 4174 --directory examples/host-page
```

Open http://localhost:4174. Both instances should appear. Solve the sidebar puzzle,
scroll the header out of view to suspend the background, and toggle your browser's
reduced-motion preference to see its static solved frame.

`example:pack` runs the package's prepack build, creates
`cirsteve-cornrow-0.1.0.tgz` here, and installs it without a lockfile. The tarball
and node_modules are ignored by Git. When changing the package version, update
this example's file dependency to match the new tarball name. To repeat the
install after rebuilding the same version, remove this example's node_modules
first so npm cannot reuse its previous installation.

To run each step yourself from the repository root:

```sh
npm pack --pack-destination examples/host-page
npm install --prefix examples/host-page --package-lock=false --ignore-scripts --offline
python3 -m http.server 4174 --directory examples/host-page
```
