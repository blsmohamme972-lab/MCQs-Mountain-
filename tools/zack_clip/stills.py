import sys, bpy
a = sys.argv[sys.argv.index("--") + 1:]
sc = bpy.context.scene
sc.render.resolution_percentage = int(a[1])
sc.cycles.samples = 6
for f in a[2:]:
    sc.frame_set(int(f))
    sc.render.filepath = f"{a[0]}_{int(f):04d}.png"
    bpy.ops.render.render(write_still=True)
