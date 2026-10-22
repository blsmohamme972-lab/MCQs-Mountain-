# Clip 2: "The 11-year-old who gave Lincoln his beard" (10 s, Zack D Films style)

True story: Grace Bedell (11) wrote to Abraham Lincoln on 15 Oct 1860 suggesting a beard; he replied on 19 Oct 1860
("...do you not think people would call it a piece of silly affection if I were to begin it now?") and grew one.

Pipeline (Blender 4.2, always `--factory-startup --disable-autoexec`; data only, no add-on code):
1. Character: `build_girl.py <mpfb/data> <assets> <faceunits> grace.blend grace.json` (ponytail, child body, 1.40 m)
2. Motion: `anim_lincoln.py -- typing.fbx grace_anim.blend` (Mixamo typing frames 1-300 as writing)
3. Textures: `lincoln_letters.py <font_dir> tex/` (her letter + nib path, Lincoln's reply, envelope, bulb, sparkle);
   `lincoln_portrait.py <photos> portrait/` (public-domain photos from Wikimedia Commons: Hesler 1860 clean-shaven,
   LoC "first portrait with a full beard" 1861; the beard is aligned onto the 1860 face and grown in)
4. Scene: `scene_lincoln.py -- <ph_lincoln> <ph_tables> tex/ portrait/ calico.png scene.blend post.json`
   Poly Haven: vintage_oil_lamp, standing_picture_frame_01, WoodenTable_01, painted_wooden_chair_01, wooden_bookshelf_worn,
   book_encyclopedia_set_01, spinning_wheel_01, Rockingchair_01, vintage_wooden_drawer_01, mantel_clock_01, jug_01,
   wooden_candlestick, hanging_picture_frame_02, HDRI rogland_moonlit_night.
5. Narration (owner chose Breeze): `narrate.py voice/ narration.json`, `listen.py` (Whisper word times),
   `vo_tighten.py` (pauses <= 0.34 s) -> 9.7 s.
6. Render, then `post_lincoln.py frames/ out/ vo_tight.wav post.json tex/ <font_dir>` (captions in the reference style:
   Nunito ExtraBold, sentence case, 78% height; bulb/sparkle pops; grain; sound bed + VO) -> MP4 720x1280.

Shots (frames): 1a 1-35 wide, 1b 36-73 face writing, 2 74-124 pen writes "Lincoln", 3 125-148 thinking + bulb,
4 149-174 photo + chalk beard, 5 175-231 reply letter, 6 232-270 beard grows, 7 271-300 proud smile.
Review loop used: low-res full preview -> per-shot strips -> 4 critic agents + skeptic verification -> fix -> repeat.
