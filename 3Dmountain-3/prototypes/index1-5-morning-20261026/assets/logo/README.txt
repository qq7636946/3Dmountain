FINNOVATION closing mark — rebuilt from the supplied root logo3D.svg.
Authoring tool: Blender 4.3.2.

logo3d-blender-v1.blend: editable master. The hidden "Editable bevel construction"
collection contains the clean original solids and editable Bevel / Weighted
Normal modifiers. The visible logo_body and logo_sail are the cleaned export
meshes, with authored split normals. The SVG is saved inside the blend Text data.

logo3d-blender-v1.glb: web asset, no baked glass material. The website applies
its existing water-glass material, brand blue, lights and scroll rotation.
Combined height is normalized to 1, centered, front +Z in glTF Y-up coordinates.
Base thickness .148; edge radius .009; 10 bevel segments; 29,996 triangles.
The live size and optical controls remain available; the thickness control
scales the baked depth. Bevel/crown geometry is now authored in Blender.

Topology validation: both solids have zero boundary edges, zero non-manifold
edges, zero loose edges and zero degenerate faces; positive signed volume.
Full audit: logo3d-blender-v1-audit.json.

SVG cleanup removed only sub-pixel contact/sliver artifacts (0.00004 of height).
No geometry or triangulation from the old browser extrusion was reused.
Build/inspection scripts are retained at .qa/logo3d-blender-20261025/.

Local shape controls:
Run scripts/index1-5/start-logo-model-server.ps1 to start Blender's hidden
local modeling service at 127.0.0.1:8788. The website's LOGO panel (M key)
provides radius, surface detail, profile, weighted normals, normal weight and
smooth shading. Press 套用建模 to rebuild the real
Blender geometry; size/thickness/material/light sliders remain immediate.
The original v1 files remain immutable. Edited geometry is exported to
logo3d-tuned.glb / logo3d-tuned.blend and selected by logo3d-current.json.
全部還原 rebuilds the default rounded geometry. The selected GLB and manifest can be
published as ordinary static assets; the Blender service is only for local editing.

2026-10-25 bevel correction:
The immutable v1 Bevel modifier's global overlap clamp suppressed its radius
because of tiny SVG tips/triangles. The active pipeline now reconstructs a
closed rounded extrusion from logo3d-outline.json with a signed distance field,
then simplifies and exports it through Blender. Front/back faces stay planar;
the curved rim does not reuse the former cap triangles or intersecting bevels.
scripts/index1-5/logo-sdf-mesh.py generates the surface; logo-model-server.py
validates topology, actual volume change and depth levels before publishing.
One-time local dependencies: scripts/index1-5/setup-logo-model-runtime.ps1.
The dependency folder stays in LocalAppData, outside the synced project.

Approved default rounded preset (2026-10-25): radius .020, detail 24, profile .5,
weighted normals 1, normal weight 50, smooth shading 1.
Profile .5 is round; profile 1 is nearly square (a comparison endpoint).
The obsolete modifier angle/global-overlap controls are hidden; old parameter
JSON remains accepted for compatibility. Material, position and scale are unchanged.
The tuned GLB / blend / audit contain the corrected shape. The original v1
assets are retained solely for recovery and are not the corrected roundover.

Fast adjustment preview:
start-logo-model-server.ps1 also starts the resident local Python preview
service (127.0.0.1:8789). Shape dials automatically request a memory-only SDF
preview, with the same SVG outline/profile and the existing website material.
Requests are coalesced while dragging; old requests cannot replace a precise
apply. No preview GLB, blend or manifest is written to the synced project.
The 精細套用 button performs the original validated Blender export and saves
the selected settings. Preview changes alone are not a saved production asset.
CPU browser integration measured 309ms from input to loaded preview geometry;
the same precise apply took 16.0 seconds. Continuous-input ordering, material
identity and the explicit-save boundary are verified in
.qa/logo-fast-preview-20261025/cpu-browser-verification.json.
