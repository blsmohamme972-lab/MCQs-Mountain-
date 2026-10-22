"""Zack D-style look: Cycles settings + compositor (mist haze, glow, split-tone grade)."""
import bpy


def render_settings(sc, width=540, height=960, pct=80, samples=10):
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 4
    sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.resolution_percentage = pct
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.fps = 30


def compositor(sc, fog=(0.05, 0.12, 0.28), fog_amount=0.55, mist_start=0.6, mist_depth=6.0,
               glow=0.75, lift=(0.93, 0.97, 1.08), gain=(1.06, 1.0, 0.92)):
    """Haze tinted `fog` that grows with distance, a soft glow on bright practicals, cool shadows / warm highlights."""
    sc.view_layers[0].use_pass_mist = True
    if sc.world:
        sc.world.mist_settings.start = mist_start
        sc.world.mist_settings.depth = mist_depth
        sc.world.mist_settings.falloff = "QUADRATIC"
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new("CompositorNodeRLayers")
    amt = nt.nodes.new("CompositorNodeMath")
    amt.operation = "MULTIPLY"
    amt.inputs[1].default_value = fog_amount
    nt.links.new(rl.outputs["Mist"], amt.inputs[0])
    mix = nt.nodes.new("CompositorNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[2].default_value = (*fog, 1)
    nt.links.new(amt.outputs[0], mix.inputs[0])
    nt.links.new(rl.outputs["Image"], mix.inputs[1])
    gl = nt.nodes.new("CompositorNodeGlare")
    gl.glare_type = "FOG_GLOW"
    gl.quality = "MEDIUM"
    gl.threshold = glow
    gl.mix = -0.6
    gl.size = 8
    nt.links.new(mix.outputs[0], gl.inputs[0])
    cb = nt.nodes.new("CompositorNodeColorBalance")
    cb.correction_method = "LIFT_GAMMA_GAIN"
    cb.lift = lift
    cb.gain = gain
    nt.links.new(gl.outputs[0], cb.inputs[1])
    out = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(cb.outputs[0], out.inputs[0])
    return nt
