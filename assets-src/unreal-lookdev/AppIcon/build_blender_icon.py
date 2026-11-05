"""Create an original, editable Bingo Royale icon without touching other scenes.

Run with Blender's Python API. The .blend contains only this scene and its
dependencies; the user's open scene and unsaved work are left intact.
"""
import hashlib
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'SourceMeshes'
OUT.mkdir(parents=True, exist_ok=True)
PREFIX = 'BRI_'
MATERIALS = {}


def linear_hex(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]


def material(name, color, metallic=0, roughness=.27, coat=.3, coat_roughness=.15):
    name = PREFIX + name
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = linear_hex(color)
    for pin, value in [('Base Color', (*rgb, 1)), ('Metallic', metallic),
                       ('Roughness', roughness), ('Coat Weight', coat),
                       ('Coat Roughness', coat_roughness)]:
        shader.inputs[pin].default_value = value
    m.diffuse_color = (*rgb, 1)
    MATERIALS[name] = dict(base_color=rgb, metallic=metallic, roughness=roughness,
                         coat=coat, coat_roughness=coat_roughness)
    return m


def finish(obj, mat, bevel=0, smooth=False):
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width, mod.segments = bevel, 4
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def profile(name, points, front, back, mat, bevel=.02):
    n = len(points)
    verts = [(x, y, z) for y in (front, back) for x, z in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(PREFIX + name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    # Recalculate outward-facing normals before beveling and export.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return finish(obj, mat, bevel)


def rounded_square(name, size, radius, front, back, mat, bevel=.02):
    points = []
    h = size / 2
    for cx, cz, angle in [(h-radius, h-radius, 0), (-h+radius, h-radius, 90),
                          (-h+radius, -h+radius, 180), (h-radius, -h+radius, 270)]:
        for step in range(17):
            a = math.radians(angle + step * 90 / 16)
            points.append((cx + radius * math.cos(a), cz + radius * math.sin(a)))
    return profile(name, points, front, back, mat, bevel)


def sphere(name, position, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=radius, location=position)
    obj = bpy.context.object
    obj.name = PREFIX + name
    return finish(obj, mat, smooth=True)


def torus(name, radius, tube, position, mat, front=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=tube,
                                    major_segments=160, minor_segments=16, location=position)
    obj = bpy.context.object
    obj.name = PREFIX + name
    if front:
        obj.rotation_euler[0] = math.pi / 2
    return finish(obj, mat, smooth=True)


def ball(blue, ivory):
    # Polar axis is -Y. An exact ring at the ivory boundary avoids a jagged
    # painted medallion, while preserving the sphere's real curved surface.
    radius, center_z, boundary = .73, -.21, .76
    polar = sorted(set([math.pi * i / 128 for i in range(1, 128)] + [boundary]))
    segments = 192
    verts = [(0, -radius, center_z)]
    for p in polar:
        for i in range(segments):
            a = 2 * math.pi * i / segments
            verts.append((radius * math.sin(p) * math.cos(a), -radius * math.cos(p),
                          center_z + radius * math.sin(p) * math.sin(a)))
    verts.append((0, radius, center_z))
    faces, whites = [], []
    for i in range(segments):
        faces.append((0, 1+i, 1+(i+1) % segments)); whites.append(True)
    for j in range(len(polar)-1):
        for i in range(segments):
            a, b = 1 + j * segments + i, 1 + j * segments + (i+1) % segments
            faces.append((a, a+segments, b+segments, b)); whites.append(polar[j+1] <= boundary + 1e-8)
    last, end = 1 + (len(polar)-1)*segments, len(verts)-1
    for i in range(segments):
        faces.append((last+i, end, last+(i+1) % segments)); whites.append(False)
    mesh = bpy.data.meshes.new(PREFIX + 'Ball_Mesh')
    mesh.from_pydata(verts, [], faces); mesh.update()
    obj = bpy.data.objects.new(PREFIX + 'Cobalt_bingo_ball', mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(blue); mesh.materials.append(ivory)
    for p, white in zip(mesh.polygons, whites):
        p.material_index = int(white); p.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return obj


def lettering(body, height, z, mat, font):
    curve = bpy.data.curves.new(PREFIX + 'Number_' + body, 'FONT')
    curve.body, curve.align_x, curve.align_y = body, 'CENTER', 'CENTER'
    curve.font, curve.size = font, 1
    curve.extrude, curve.bevel_depth = 0, 0
    obj = bpy.data.objects.new(PREFIX + 'Number_' + body, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler[0] = math.pi / 2
    obj.location = (0, -.73, z)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    vertices = obj.data.vertices
    xmin, xmax = min(v.co.x for v in vertices), max(v.co.x for v in vertices)
    zmin, zmax = min(v.co.z for v in vertices), max(v.co.z for v in vertices)
    factor = height / (zmax - zmin)
    for vertex in vertices:
        vertex.co.x = (vertex.co.x - (xmin + xmax) / 2) * factor
        vertex.co.z = (vertex.co.z - (zmin + zmax) / 2) * factor
        vertex.co.y *= factor
    # Tessellate the painted glyph before projection: large planar triangles
    # would cut through the sphere between their boundary vertices.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=10, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    # Conform the raised ink to the sphere instead of leaving floating letters.
    for vertex in obj.data.vertices:
        x = vertex.co.x
        local_z = vertex.co.z + z + .21
        surface_y = -math.sqrt(max(.001, .73 ** 2 - x ** 2 - local_z ** 2))
        vertex.co.y = surface_y + .73 - .0015
    obj.select_set(False)
    return finish(obj, mat, smooth=True)


def main():
    window = bpy.context.window
    previous_scene, previous_layer = window.scene, window.view_layer
    for old in list(bpy.data.scenes):
        if old.name.startswith('Bingo Royale • Crowned app icon') and old != previous_scene:
            for obj in list(old.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new('Bingo Royale • Crowned app icon')
    try:
        window.scene = scene
        window.view_layer = scene.view_layers[0]
        blue = material('Cobalt_resin', '#1459e5', roughness=.19, coat=.48, coat_roughness=.12)
        ivory = material('Ivory_number_face', '#fff8e7', roughness=.28, coat=.25)
        ink = material('Midnight_ink', '#10244a', roughness=.33, coat=.15)
        gold = material('Champagne_gold', '#f7c75c', metallic=1, roughness=.24, coat=0)
        navy = material('Midnight_enamel', '#101a3c', roughness=.3, coat=.38)
        edge = material('Indigo_frame', '#263a73', metallic=.45, roughness=.27, coat=.3)
        gem = material('Sapphire_gem', '#1b58cf', metallic=.12, roughness=.13, coat=.55)
        rounded_square('Indigo_outer_frame', 2.50, .38, .36, .54, edge, .025)
        rounded_square('Fine_gold_lip', 2.40, .34, .32, .40, gold, .012)
        rounded_square('Midnight_inset', 2.355, .32, .295, .36, navy, .022)
        ball(blue, ivory)
        r = .73 * math.sin(.76)
        torus('Medallion_gold_pinstripe', r, .0105, (0, -.73*math.cos(.76)-.004, -.21), gold, True)
        font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf')
        lettering('B', .175, .015, ink, font)
        lettering('8', .54, -.365, ink, font)
        crown_points = [(-.43,.34),(.43,.34),(.585,.89),(.28,.665),(0,1.035),(-.28,.665),(-.585,.89)]
        profile('Royal_crown', crown_points, -.31, -.155, gold, .028)
        torus('Crown_band', .43, .047, (0, 0, .35), gold)
        for x, z in [(-.585,.89),(0,1.035),(.585,.89)]:
            sphere('Crown_finial', (x,-.23,z), .044, gold)
        sphere('Crown_sapphire', (0,-.328,.50), .055, gem)
        for x,z,s in [(-.91,.20,.10),(.89,-.43,.075)]:
            points=[(x,z+s),(x+s*.23,z+s*.23),(x+s,z),(x+s*.23,z-s*.23),
                    (x,z-s),(x-s*.23,z-s*.23),(x-s,z),(x-s*.23,z+s*.23)]
            profile('Celebration_glint',points,-.08,-.045,gold,.006)

        scene.world = bpy.data.worlds.new(PREFIX + 'Studio_world')
        scene.world.use_nodes = True
        background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
        background.inputs['Color'].default_value = (.025,.04,.10,1)
        background.inputs['Strength'].default_value = .35
        for name,loc,power,size,color in [('Key',(-2,-3,3.5),400,3,(1,.88,.7)),
                                          ('Fill',(2,-2,-1),110,3,(.55,.7,1)),
                                          ('Rim',(1,1,2),500,2,(.6,.75,1))]:
            data = bpy.data.lights.new(PREFIX+name,'AREA')
            data.energy, data.shape, data.size, data.color = power,'DISK',size,color
            obj = bpy.data.objects.new(PREFIX+name,data); scene.collection.objects.link(obj)
            obj.location=loc; obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
        data=bpy.data.cameras.new(PREFIX+'Camera')
        camera=bpy.data.objects.new(PREFIX+'Camera',data);scene.collection.objects.link(camera)
        camera.location=(0,-5,0);camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
        data.type,data.ortho_scale='ORTHO',2.62
        scene.camera=camera
        scene.render.engine='BLENDER_EEVEE_NEXT'
        scene.render.resolution_x=scene.render.resolution_y=1024
        scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'
        scene.render.image_settings.color_mode='RGBA'
        scene.render.film_transparent=True
        scene.render.filepath=str(ROOT/'blender-preview.png')

        # FBX uses an isolated evaluated mesh with normals and modifiers baked.
        sources=[o for o in scene.objects if o.type=='MESH']
        dg=bpy.context.evaluated_depsgraph_get()
        verts,faces,slots,face_slots,face_smooth=[],[],[],[],[]
        for obj in sources:
            mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),depsgraph=dg)
            mesh.calc_loop_triangles()
            offset=len(verts)
            transform=Matrix.Rotation(math.pi/2,4,'Z') @ Matrix.Scale(40,4) @ obj.matrix_world
            verts.extend(tuple(transform@v.co) for v in mesh.vertices)
            local=[]
            for m in mesh.materials:
                if m.name not in slots: slots.append(m.name)
                local.append(slots.index(m.name))
            for p in mesh.polygons:
                faces.append(tuple(offset+i for i in p.vertices));face_slots.append(local[p.material_index]);face_smooth.append(p.use_smooth)
            bpy.data.meshes.remove(mesh)
        mesh=bpy.data.meshes.new('SM_BingoRoyaleAppIcon_Mesh');mesh.from_pydata(verts,[],faces);mesh.update()
        for name in slots:mesh.materials.append(bpy.data.materials[name])
        for p,slot,smooth in zip(mesh.polygons,face_slots,face_smooth):p.material_index=slot;p.use_smooth=smooth
        export_obj=bpy.data.objects.new('SM_BingoRoyaleAppIcon',mesh)
        scene.collection.objects.link(export_obj)
        for o in scene.objects:o.select_set(False)
        export_obj.select_set(True);bpy.context.view_layer.objects.active=export_obj
        fbx=OUT/'SM_BingoRoyaleAppIcon.fbx'
        bpy.ops.export_scene.fbx(filepath=str(fbx),check_existing=False,use_selection=True,
            object_types={'MESH'},global_scale=1,apply_unit_scale=True,apply_scale_options='FBX_SCALE_NONE',
            axis_forward='-X',axis_up='Z',use_space_transform=False,bake_space_transform=False,
            use_mesh_modifiers=False,mesh_smooth_type='FACE',use_triangles=True,bake_anim=False,
            add_leaf_bones=False,path_mode='STRIP',embed_textures=False)
        mesh.calc_loop_triangles()
        manifest=dict(name='SM_BingoRoyaleAppIcon',fbx=fbx.name,front_axis='+X',material_slots=slots,
                      materials=MATERIALS,vertices=len(mesh.vertices),triangles=len(mesh.loop_triangles),
                      sha256=hashlib.sha256(fbx.read_bytes()).hexdigest())
        (OUT/'mesh-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        bpy.data.objects.remove(export_obj,do_unlink=True);bpy.data.meshes.remove(mesh)
        # Write a standalone library rather than saving the user's open file.
        bpy.data.libraries.write(str(ROOT/'bingo-royale-app-icon.blend'),{scene},fake_user=True)
        print(json.dumps(dict(blend=str(ROOT/'bingo-royale-app-icon.blend'),fbx=str(fbx),
                              source_objects=len(sources),triangles=manifest['triangles'])))
    finally:
        window.scene=previous_scene;window.view_layer=previous_layer


if __name__=='__main__':
    main()
