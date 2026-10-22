# Zack D Films-style test clip (10 s, 30 fps, vertical)

Girl (11 y, 1.40 m) built with plain bpy + numpy from MakeHuman CC0 **data files only** (no MPFB add-on code).
Always run Blender with `--factory-startup --disable-autoexec`. Cycles only (no EGL here).

1. Data: MPFB zip from files2.makehumancommunity.org/plugins/ (read only `mpfb/data/`), `makehuman_system_assets_cc0.zip`,
   `functional/faceunits01.zip`; Mixamo FBX from Drive (typing, sitting_disbelief); Poly Haven via `ph_get.py`
   (`white_home_studio SchoolChair_01 SchoolDesk_01 classic_laptop desk_lamp_arm_01 potted_plant_01`); Montserrat.
2. `blender -b -P build_girl.py -- <mpfb/data> <assets> <faceunits> girl.blend`
3. `blender -b girl.blend -P retarget.py -- typing.fbx disbelief.fbx girl_anim.blend`
4. `python3 screens.py Montserrat.ttf screen/` (laptop screen sequence + poster)
5. `blender -b girl_anim.blend -P scene.py -- <polyhaven assets> screen/ scene.blend`, then `blender -b scene.blend -o frames/f_#### -F PNG -a`
6. `python3 post.py Montserrat.ttf frames/ cap/` (captions, vignette, sfx.wav), then ffmpeg to MP4.

Lessons: universal-*-averagemuscle-averageweight targets are empty; height comes from solving the maxheight weight for 1.40 m;
high-poly eyes need texture alpha (cornea) or they render black; teeth/tongue are adult-sized (shrunk and pushed back);
the typing clip turns the head away, so scene.py aims the head at the screen until the shock.
Review a low-res preview of all frames (`fastprev`) before any final render.
