"""Re-render the ball machine's two web layers from ball-machine.blend.

    /Applications/Blender.app/Contents/MacOS/Blender -b ball-machine.blend -P render_layers.py

machine-back.webp   the whole machine, no balls
machine-front.webp  only what stands in front of the globe's centre plane
                    (glass highlights, front of the rings, cup and chute)

The game draws the live balls on a canvas between the two layers. If the camera
or the globe moves, update MACHINE_ART in
apps/client/src/components/stage/BallMachine.tsx (the script prints the values).
"""
import os
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

scene = bpy.context.scene
out = os.path.normpath(os.path.join(os.path.dirname(bpy.data.filepath), "../../apps/client/public/images/stage"))
os.makedirs(out, exist_ok=True)

scene.render.engine = "CYCLES"
scene.cycles.samples = 384
scene.render.film_transparent = True
scene.cycles.film_transparent_glass = True
scene.render.resolution_x, scene.render.resolution_y = 900, 920
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 90

bpy.data.collections["ReferenceBalls"].hide_render = True
cut = bpy.data.objects["FrontCut"]  # holdout card on the globe's centre plane

for name, front in (("machine-back", False), ("machine-front", True)):
    cut.hide_render = not front
    scene.render.filepath = os.path.join(out, name + ".webp")
    bpy.ops.render.render(write_still=True)
cut.hide_render = True

def fraction(point):
    v = world_to_camera_view(scene, scene.camera, Vector(point))
    return round(v.x, 4), round(1 - v.y, 4)

centre, edge = fraction((0, 0, 1.75)), fraction((1, 0, 1.75))
print("MACHINE_ART", {
    "globeX": centre[0], "globeY": centre[1], "globeRadius": round(edge[0] - centre[0], 4),
    "railY": fraction((1.8, 0, 0.10))[1], "mouth": fraction((1.52, 0, 0.34)),
})
