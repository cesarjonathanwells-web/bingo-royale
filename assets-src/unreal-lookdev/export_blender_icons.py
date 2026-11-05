"""Export the existing Bingo Royale collectibles as isolated Unreal FBX meshes.

Run inside the connected Blender 4.5+ session, without opening another .blend::

    path = '/Users/cesarwells/Developer/bingo-royale/assets-src/unreal-lookdev/export_blender_icons.py'
    exec(compile(open(path, encoding='utf-8').read(), path, 'exec'), {'__file__': path})

The saved icon library is appended into a temporary scene. Evaluated geometry
includes the existing bevels, curves and object transforms. The artist's active
scene, view layer, selection, active object and saved file are left intact.
Only SourceMeshes/*.fbx and SourceMeshes/manifest.json are written to disk.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(globals().get('__file__',
    '/Users/cesarwells/Developer/bingo-royale/assets-src/unreal-lookdev/export_blender_icons.py')).resolve().parent
SOURCE = HERE.parent / 'blender-balls' / 'original-style-icons.blend'
BALL_SOURCE = HERE.parent / 'blender-balls' / 'original-style-balls.blend'
OUT = HERE / 'SourceMeshes'
SOURCE_SCENE = 'Bingo Royale • Collectible icon studio'
MAX_DIMENSION_CM = 10.0

ASSETS = (
    ('wild_square', 'SM_WildSquare'),
    ('shield', 'SM_Shield'),
    ('turbo_stamp', 'SM_TurboStamp'),
    ('ink_blot', 'SM_InkBlot'),
    ('number_peek', 'SM_NumberPeek'),
    ('scramble', 'SM_Scramble'),
    ('callers_choice', 'SM_CallersChoice'),
    ('double_daub', 'SM_DoubleDaub'),
    ('crown', 'SM_Crown'),
)

MATERIAL_NAMES = {
    'Gold • polished metal': 'M_GoldMetal',
    'Lilac • enamel': 'M_LilacEnamel',
    'Blue • enamel': 'M_BlueEnamel',
    'Pearl • enamel': 'M_PearlEnamel',
    'Red • enamel': 'M_RedEnamel',
    'Pupil • dark resin': 'M_DarkResin',
    'Victory hand • satin resin': 'M_SkinResin',
}

# The source icons face -Y; rotate their evaluated vertices so fronts face +X.
# Source +X (image-right) becomes FBX +Y. Unreal's RH→LH conversion flips that
# to -Y, which is image-right for a camera at +X looking toward the origin.
TO_FRONT_X = Matrix.Rotation(math.pi / 2, 4, 'Z')


def shader_value(material, socket, fallback):
    shader = next((n for n in material.node_tree.nodes
                   if n.type == 'BSDF_PRINCIPLED'), None) if material.use_nodes else None
    value = shader.inputs[socket].default_value if shader and socket in shader.inputs else fallback
    return list(value) if hasattr(value, '__len__') else float(value)


def material_key(material):
    for original, key in MATERIAL_NAMES.items():
        # Appending a library may append Blender's .001 suffix to its ID names.
        if material.name == original or material.name.startswith(original + '.'):
            return original, key
    raise RuntimeError('Unexpected source material: ' + material.name)


def export_icons():
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    window = bpy.context.window
    if window is None:
        raise RuntimeError('Run this script in the connected Blender window.')

    previous_scene = window.scene
    previous_layer = window.view_layer
    previous_active = previous_layer.objects.active
    previous_selected = tuple(bpy.context.selected_objects)
    original_ids = {block.as_pointer() for block in bpy.data.user_map()}
    out_materials = {}
    manifest = {
        'schema_version': 1,
        'source_blend': str(SOURCE),
        'blender_version': bpy.app.version_string,
        'geometry': 'Evaluated source meshes, bevels and curves; no source edits.',
        'units': 'centimeters; 1 exported unit = 1 cm',
        'front': '+X',
        'up': '+Z',
        'fbx_axis_note': 'Blender axis_forward -X is the viewing direction; FBX FrontVector is +X toward the camera, matching Unreal force_front_x_axis.',
        'pivot': 'Combined evaluated bounding-box center for each icon.',
        'fbx_export': {
            'axis_forward': '-X', 'axis_up': 'Z',
            'use_space_transform': False,
            'apply_unit_scale': True, 'global_scale': 1.0,
            'apply_scale_options': 'FBX_SCALE_NONE',
            'scene_scale_length': 0.01,
        },
        'unreal_import': {
            'convert_scene': True, 'force_front_x_axis': True,
            'convert_scene_unit': True, 'import_uniform_scale': 1.0,
            'import_rotation_degrees': [0.0, 0.0, 0.0],
            'normal_import_method': 'FBXNIM_IMPORT_NORMALS',
            'import_materials': False, 'import_textures': False,
            'combine_meshes': True,
        },
        'materials': {},
        'assets': [],
    }

    try:
        OUT.mkdir(parents=True, exist_ok=True)
        with bpy.data.libraries.load(str(SOURCE), link=False) as (available, loaded):
            candidates = [name for name in available.scenes
                          if name == SOURCE_SCENE or name.startswith(SOURCE_SCENE + '.')]
            if len(candidates) != 1:
                raise RuntimeError('Expected one source scene matching %s; found %s'
                                   % (SOURCE_SCENE, available.scenes))
            loaded.scenes = candidates
        source_scene = loaded.scenes[0]
        manifest['source_scene'] = source_scene.name
        window.scene = source_scene
        window.view_layer = source_scene.view_layers[0]
        depsgraph = bpy.context.evaluated_depsgraph_get()

        # Use centimeters explicitly: geometry is 10 units wide/tall in this
        # temporary scene and scale_length .01 gives FBX UnitScaleFactor 1.
        export_scene = bpy.data.scenes.new('BR • temporary Unreal mesh export')
        export_scene.unit_settings.system = 'METRIC'
        export_scene.unit_settings.scale_length = 0.01
        export_scene.unit_settings.length_unit = 'CENTIMETERS'

        def ensure_material(source_material):
            original, key = material_key(source_material)
            if key not in out_materials:
                material = source_material.copy()
                material.name = key
                out_materials[key] = material
                manifest['materials'][key] = {
                    'source_name': original,
                    'fbx_material_name': material.name,
                    'base_color': shader_value(source_material, 'Base Color', [0.8, 0.8, 0.8, 1.0]),
                    'metallic': shader_value(source_material, 'Metallic', 0.0),
                    'roughness': shader_value(source_material, 'Roughness', 0.5),
                    'coat': shader_value(source_material, 'Coat Weight', 0.0),
                    'coat_roughness': shader_value(source_material, 'Coat Roughness', 0.03),
                    'color_space': 'linear RGB values from Blender Principled BSDF',
                }
            return key, out_materials[key]

        for source_name, asset_name in ASSETS:
            window.scene = source_scene
            window.view_layer = source_scene.view_layers[0]
            depsgraph = bpy.context.evaluated_depsgraph_get()
            prefix = 'Icon • ' + source_name
            candidates = [c for c in source_scene.collection.children
                          if c.name == prefix or c.name.startswith(prefix + '.')]
            if len(candidates) != 1:
                raise RuntimeError('Expected one source collection: ' + prefix)
            collection = candidates[0]
            vertices, faces, normals, smooth_flags, face_materials = [], [], [], [], []
            uv_coords, slot_keys, slots = [], [], []
            had_uvs = False
            source_objects = []

            for source_obj in sorted(collection.all_objects, key=lambda o: o.name):
                if source_obj.type not in {'MESH', 'CURVE', 'SURFACE', 'FONT', 'META'}:
                    continue
                evaluated = source_obj.evaluated_get(depsgraph)
                evaluated_mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
                if evaluated_mesh is None:
                    raise RuntimeError('Could not evaluate: ' + source_obj.name)
                try:
                    vertex_offset = len(vertices)
                    world = source_obj.matrix_world
                    normal_matrix = TO_FRONT_X.to_3x3() @ world.to_3x3().inverted().transposed()
                    vertices.extend(world @ vertex.co for vertex in evaluated_mesh.vertices)
                    slot_map = []
                    for source_material in evaluated_mesh.materials:
                        if source_material is None:
                            raise RuntimeError('Empty material slot: ' + source_obj.name)
                        key, material = ensure_material(source_material)
                        if key not in slot_keys:
                            slot_keys.append(key)
                            slots.append(material)
                        slot_map.append(slot_keys.index(key))
                    uv_layer = evaluated_mesh.uv_layers.active
                    had_uvs |= uv_layer is not None
                    for polygon in evaluated_mesh.polygons:
                        faces.append(tuple(vertex_offset + index for index in polygon.vertices))
                        smooth_flags.append(polygon.use_smooth)
                        face_materials.append(slot_map[polygon.material_index])
                        for loop_index in polygon.loop_indices:
                            normal = normal_matrix @ evaluated_mesh.corner_normals[loop_index].vector
                            normal.normalize()
                            normals.append(tuple(normal))
                            uv_coords.append(tuple(uv_layer.data[loop_index].uv) if uv_layer else (0.0, 0.0))
                    source_objects.append(source_obj.name)
                finally:
                    evaluated.to_mesh_clear()

            if not vertices or not faces:
                raise RuntimeError('No geometry found for ' + source_name)
            lower = Vector(tuple(min(co[axis] for co in vertices) for axis in range(3)))
            upper = Vector(tuple(max(co[axis] for co in vertices) for axis in range(3)))
            center = (lower + upper) * 0.5
            scale = MAX_DIMENSION_CM / max(upper - lower)
            baked = [TO_FRONT_X @ ((co - center) * scale) for co in vertices]
            mesh = bpy.data.meshes.new(asset_name + '_Mesh')
            mesh.from_pydata(baked, [], faces)
            mesh.update()
            for material in slots:
                mesh.materials.append(material)
            for polygon, smooth, slot in zip(mesh.polygons, smooth_flags, face_materials):
                polygon.use_smooth = smooth
                polygon.material_index = slot
            if had_uvs:
                uv_layer = mesh.uv_layers.new(name='UVMap')
                for loop, coordinate in zip(uv_layer.data, uv_coords):
                    loop.uv = coordinate
            if len(normals) != len(mesh.loops):
                raise RuntimeError('Custom normal count mismatch for ' + source_name)
            mesh.normals_split_custom_set(normals)
            mesh.update()
            mesh.calc_loop_triangles()

            obj = bpy.data.objects.new(asset_name, mesh)
            obj['bingo_source_icon'] = source_name
            obj['front_axis'] = '+X'
            obj['units'] = 'centimeters'
            export_scene.collection.objects.link(obj)
            window.scene = export_scene
            window.view_layer = export_scene.view_layers[0]
            for other in export_scene.objects:
                other.select_set(False)
            obj.select_set(True)
            window.view_layer.objects.active = obj
            window.view_layer.update()
            output_path = OUT / (asset_name + '.fbx')
            result = bpy.ops.export_scene.fbx(
                filepath=str(output_path), check_existing=False,
                use_selection=True, object_types={'MESH'},
                global_scale=1.0, apply_unit_scale=True,
                apply_scale_options='FBX_SCALE_NONE',
                # FBX FrontVector points toward the camera, the opposite of
                # Blender's axis_forward viewing direction. -X writes +X Front.
                axis_forward='-X', axis_up='Z', use_space_transform=False,
                bake_space_transform=False,
                use_mesh_modifiers=False, mesh_smooth_type='FACE',
                use_triangles=True, use_tspace=False,
                bake_anim=False, add_leaf_bones=False,
                use_custom_props=True, path_mode='STRIP', embed_textures=False,
            )
            if result != {'FINISHED'} or not output_path.is_file():
                raise RuntimeError('FBX export failed: ' + asset_name)
            dims = [max(co[axis] for co in baked) - min(co[axis] for co in baked)
                    for axis in range(3)]
            manifest['assets'].append({
                'name': asset_name, 'source_name': source_name,
                'fbx': output_path.name, 'source_collection': prefix,
                'source_objects': source_objects,
                'dimensions_cm': [round(value, 6) for value in dims],
                'source_bounds_center': list(center),
                'material_slots': slot_keys,
                'vertex_count': len(mesh.vertices),
                'triangle_count': len(mesh.loop_triangles),
                'has_source_uvs': had_uvs,
                'normal_source': 'evaluated source corner normals, transformed and baked',
            })
            print('Exported %s: %s cm; slots %s' % (asset_name, dims, slot_keys))
            # This icon is complete; leave the next export's scene unambiguous.
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.meshes.remove(mesh)

        # Use the original 96×64 UV sphere for the 1024px look-development
        # renders rather than a lower-resolution engine primitive.
        with bpy.data.libraries.load(str(BALL_SOURCE), link=False) as (available, loaded):
            candidates = [name for name in available.scenes
                          if name.startswith('Bingo Royale • Resin ball studio')]
            if len(candidates) != 1:
                raise RuntimeError('Expected one resin ball source scene; found %s' % available.scenes)
            loaded.scenes = candidates
        ball_scene = loaded.scenes[0]
        window.scene = ball_scene
        window.view_layer = ball_scene.view_layers[0]
        depsgraph = bpy.context.evaluated_depsgraph_get()
        ball_sources = [obj for obj in ball_scene.objects if obj.type == 'MESH']
        if len(ball_sources) != 1:
            raise RuntimeError('Expected one source resin sphere, found %d' % len(ball_sources))
        source_obj = ball_sources[0]
        evaluated = source_obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        mesh.name = 'SM_BingoBall_Mesh'
        mesh.transform(source_obj.matrix_world)
        lower = Vector(tuple(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
        upper = Vector(tuple(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
        center = (lower + upper) * 0.5
        scale = MAX_DIMENSION_CM / max(upper - lower)
        mesh.transform(TO_FRONT_X @ Matrix.Scale(scale, 4) @ Matrix.Translation(-center))
        ball_material = mesh.materials[0].copy()
        ball_material.name = 'M_BallResin'
        mesh.materials.clear()
        mesh.materials.append(ball_material)
        mesh.update()
        mesh.calc_loop_triangles()
        obj = bpy.data.objects.new('SM_BingoBall', mesh)
        obj['bingo_source_ball'] = 'original-style-balls.blend'
        obj['front_axis'] = '+X'
        obj['units'] = 'centimeters'
        export_scene.collection.objects.link(obj)
        window.scene = export_scene
        window.view_layer = export_scene.view_layers[0]
        for other in export_scene.objects:
            other.select_set(False)
        obj.select_set(True)
        window.view_layer.objects.active = obj
        window.view_layer.update()
        output_path = OUT / 'SM_BingoBall.fbx'
        result = bpy.ops.export_scene.fbx(
            filepath=str(output_path), check_existing=False,
            use_selection=True, object_types={'MESH'},
            global_scale=1.0, apply_unit_scale=True,
            apply_scale_options='FBX_SCALE_NONE',
            axis_forward='-X', axis_up='Z', use_space_transform=False,
            bake_space_transform=False,
            use_mesh_modifiers=False, mesh_smooth_type='FACE',
            use_triangles=True, use_tspace=False,
            bake_anim=False, add_leaf_bones=False,
            use_custom_props=True, path_mode='STRIP', embed_textures=False,
        )
        if result != {'FINISHED'} or not output_path.is_file():
            raise RuntimeError('FBX sphere export failed')
        manifest['ball_mesh'] = {
            'name': 'SM_BingoBall', 'fbx': output_path.name,
            'source_blend': str(BALL_SOURCE), 'source_object': source_obj.name,
            'dimensions_cm': [round(value, 6) for value in obj.dimensions],
            'material_slots': ['M_BallResin'],
            'vertex_count': len(mesh.vertices),
            'triangle_count': len(mesh.loop_triangles),
            'has_source_uvs': bool(mesh.uv_layers),
            'normal_source': 'smooth evaluated source sphere normals',
        }
        print('Exported SM_BingoBall: %s cm; %d vertices, %d triangles'
              % (list(obj.dimensions), len(mesh.vertices), len(mesh.loop_triangles)))

        manifest_path = OUT / 'manifest.json'
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('BINGO_UNREAL_EXPORT_COMPLETE ' + str(manifest_path))
    finally:
        # Restore the artist context before deleting all temporary/appended IDs.
        window.scene = previous_scene
        window.view_layer = previous_layer
        for obj in previous_layer.objects:
            obj.select_set(obj in previous_selected)
        previous_layer.objects.active = previous_active
        temporary_ids = [block for block in bpy.data.user_map()
                         if block.as_pointer() not in original_ids]
        if temporary_ids:
            bpy.data.batch_remove(ids=temporary_ids)


export_icons()
