"""Render the five live UI ball surfaces with the shared studio look.

Run with Blender --background --factory-startup --python build.py.
Append -- --preview to render only the blue ball while tuning the rig.
"""
import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT = os.path.join(ROOT, 'apps/client/public/images/blender-balls')
os.makedirs(OUTPUT, exist_ok=True)
previous = bpy.context.window.scene
previous_layer = bpy.context.window.view_layer
previous_active = previous_layer.objects.active
previous_selected = tuple(bpy.context.selected_objects)
try:
    scene = bpy.data.scenes.new('Bingo Royale • Resin ball studio')
    bpy.context.window.scene = scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.seed = 21
    scene.cycles.use_animated_seed = False
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 80
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world = bpy.data.worlds.new('Ball studio • restrained cool ambience')
    scene.world.use_nodes = True
    background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (.15, .18, .25, 1)
    background.inputs['Strength'].default_value = .15


    def linear(value):
        value /= 255
        return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


    def rgb(color):
        return tuple(linear(int(color[index:index + 2], 16)) for index in (1, 3, 5))


    material = bpy.data.materials.new('Polished resin • subtle moulded finish')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = .30
    shader.inputs['Coat Weight'].default_value = .28
    shader.inputs['Coat Roughness'].default_value = .16
    noise = nodes.new('ShaderNodeTexNoise')
    noise.name = 'Moulded resin roughness • no artificial dirt'
    noise.inputs['Scale'].default_value = 45
    noise.inputs['Detail'].default_value = 2
    noise.inputs['Roughness'].default_value = .5
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.name = 'Resin roughness range • 0.27–0.33'
    ramp.color_ramp.elements[0].color = (.27, .27, .27, 1)
    ramp.color_ramp.elements[1].color = (.33, .33, .33, 1)
    material.node_tree.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    material.node_tree.links.new(ramp.outputs['Color'], shader.inputs['Roughness'])
    noise.location = (-520, 0)
    ramp.location = (-280, 0)
    shader.location = (20, 0)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1)
    ball = bpy.context.object
    ball.name = 'Bingo ball • resin shell'
    ball.data.materials.append(material)
    for polygon in ball.data.polygons:
        polygon.use_smooth = True


    def area(name, location, power, size, temperature, size_y=None):
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = power
        light.shape = 'RECTANGLE' if size_y else 'DISK'
        light.size = size
        if size_y:
            light.size_y = size_y
        if hasattr(light, 'use_temperature'):
            light.use_temperature = True
            light.temperature = temperature
        else:
            # Linear RGB approximations for older Blender releases.
            light.color = {5000: (1, .790, .628), 6500: (1, 1, 1), 7000: (.900, .935, 1)}[temperature]
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()


    area('Key • upper-left softbox • 5000 K', (-3, -4, 4), 350, 3, 5000, 1.65)
    area('Fill • cool right bounce • 7000 K', (3, -3, 1), 40, 3, 7000)
    area('Rim • soft silhouette separation', (2, 2, 2), 60, 3, 6500)
    camera_data = bpy.data.cameras.new('Front-facing UI camera')
    camera = bpy.data.objects.new('Front-facing UI camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0, -6, 0)
    camera.rotation_euler = (math.pi / 2, 0, 0)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 2.03
    scene.camera = camera
    # Blue is compensated for the AgX highlight roll-off; UI label colors stay live.
    palette = {'b': '#216dff', 'i': '#ef4444', 'n': '#a78bfa', 'g': '#22c55e', 'o': '#f59e0b'}
    for letter, color in palette.items():
        shader.inputs['Base Color'].default_value = (*rgb(color), 1)
        scene.render.filepath = os.path.join(OUTPUT, letter + '.png')
        bpy.ops.render.render(write_still=True)
        if '--preview' in sys.argv:
            break
    shader.inputs['Base Color'].default_value = (*rgb(palette['b']), 1)
    bpy.data.libraries.write(
        os.path.join(ROOT, 'assets-src/blender-balls/original-style-balls.blend'),
        {scene}, fake_user=True, compress=True,
    )
    print('Rendered ' + ('one blue preview' if '--preview' in sys.argv else 'five resin balls') + ' and saved the editable studio.')
finally:
    # Restore the artist's previous scene, view layer, active object and selection.
    bpy.context.window.scene = previous
    bpy.context.window.view_layer = previous_layer
    for obj in previous_layer.objects:
        obj.select_set(obj in previous_selected)
    previous_layer.objects.active = previous_active
