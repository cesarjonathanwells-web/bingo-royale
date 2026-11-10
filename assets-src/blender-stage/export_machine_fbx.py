"""Export the ball machine from ball-machine.blend for the Unreal studio.

    Blender -b ball-machine.blend -P export_machine_fbx.py

Writes three static meshes to ../unreal-lookdev/Stage/SourceMeshes:
  SM_BallMachine.fbx        the whole machine without its glass, no balls
  SM_BallMachineFront.fbx   only the metal and enamel in front of the globe's
                            centre plane; drawn over the live balls
  SM_MachineGlassFront.fbx  the front half of the glass globe, rendered on its
                            own for its highlights

All are centred on the camera target and turned so the front faces +X, the
convention used by the other meshes in ../unreal-lookdev/SourceMeshes.
Material slots: M_GoldMetal, M_MidnightEnamel, M_MachineGlass.
"""
import json
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = os.path.normpath(os.path.join(os.path.dirname(bpy.data.filepath), "../unreal-lookdev/Stage/SourceMeshes"))
os.makedirs(OUT, exist_ok=True)
SLOTS = {"Gold": "M_GoldMetal", "DarkEnamel": "M_MidnightEnamel", "Glass": "M_MachineGlass"}
TARGET = Vector((0.335, 0.0, 1.50))  # what the Blender camera looks at
# Blender front is -Y; turn it to +X and centre on the camera target.
TO_EXPORT = Matrix.Rotation(1.5707963267948966, 4, "Z") @ Matrix.Translation(-TARGET)

scene = bpy.context.scene
depsgraph = bpy.context.evaluated_depsgraph_get()
sources = [o for o in scene.objects if o.type in {"MESH", "CURVE"}
           and not o.name.startswith("Ball_") and o.name != "FrontCut"]


def build(name, front_only, glass):
    """Join the evaluated glass or non-glass parts into one mesh, optionally cut at the centre plane."""
    joined = bmesh.new()
    slot_names = list(SLOTS.values())
    for obj in sources:
        is_glass = bool(obj.material_slots) and obj.material_slots[0].material.name == "Glass"
        if is_glass != glass:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        part = bmesh.new()
        part.from_mesh(mesh)
        part.transform(obj.matrix_world)
        material = obj.material_slots[0].material.name if obj.material_slots else "Gold"
        index = slot_names.index(SLOTS[material])
        for face in part.faces:
            face.material_index = index
            face.smooth = True
        if front_only:
            geometry = part.verts[:] + part.edges[:] + part.faces[:]
            bmesh.ops.bisect_plane(part, geom=geometry, plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_outer=True)
        part.transform(TO_EXPORT)
        temp = bpy.data.meshes.new("temp")
        part.to_mesh(temp)
        joined.from_mesh(temp)
        # from_mesh keeps material indices as written above.
        bpy.data.meshes.remove(temp)
        bpy.data.meshes.remove(mesh)
        part.free()
    bmesh.ops.triangulate(joined, faces=joined.faces[:])
    mesh = bpy.data.meshes.new(name)
    joined.to_mesh(mesh)
    joined.free()
    for slot in slot_names:
        mesh.materials.append(bpy.data.materials.get(slot) or bpy.data.materials.new(slot))
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


manifest = {"target": list(TARGET), "units": "1 Blender unit = 100 cm", "front": "+X", "meshes": []}
for name, front_only, glass in (("SM_BallMachine", False, False), ("SM_BallMachineFront", True, False),
                                ("SM_MachineGlassFront", True, True)):
    obj = build(name, front_only, glass)
    for other in scene.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT, name + ".fbx")
    bpy.ops.export_scene.fbx(
        filepath=path, check_existing=False, use_selection=True, object_types={"MESH"},
        global_scale=1.0, apply_unit_scale=True, apply_scale_options="FBX_SCALE_NONE",
        # FBX FrontVector points toward the camera: -X here writes +X Front.
        axis_forward="-X", axis_up="Z", use_space_transform=False, bake_space_transform=False,
        use_mesh_modifiers=False, mesh_smooth_type="OFF", use_triangles=True, use_tspace=False,
        bake_anim=False, add_leaf_bones=False, path_mode="STRIP", embed_textures=False,
    )
    corners = [Vector(c) for c in obj.bound_box]
    manifest["meshes"].append({
        "name": name, "fbx": name + ".fbx", "triangles": len(obj.data.polygons),
        "bounds_min": [round(min(c[i] for c in corners), 4) for i in range(3)],
        "bounds_max": [round(max(c[i] for c in corners), 4) for i in range(3)],
        "material_slots": list(SLOTS.values()),
    })
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(mesh)
for slot in SLOTS.values():  # placeholder materials are only needed for slot names
    material = bpy.data.materials.get(slot)
    if material and material.users == 0:
        bpy.data.materials.remove(material)
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)
print("EXPORTED", json.dumps(manifest["meshes"]))
