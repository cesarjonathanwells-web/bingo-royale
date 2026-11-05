"""Render the original Blender app-icon mesh in Unreal Engine.

Run through the dedicated BingoRoyaleLookdev editor's Python automation::

    import importlib.util, sys
    path = '/absolute/path/to/AppIcon/render_app_icon.py'
    spec = importlib.util.spec_from_file_location('bingo_app_icon_studio', path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.main(resolution=1024, samples=16)

The final still is ``renders/bingo-royale-icon.0000.png``. Rendering is
asynchronous; keep Unreal open until renders/status.json reports complete.
Use resolution=2048, samples=64 for the delivery master. All maps, materials
and imported meshes live under /Game/BingoAppIcon. The existing artwork maps,
materials and the user's Movie Render Queue jobs are left intact.
"""

import importlib.util
import json
from pathlib import Path
import sys
import traceback

import unreal


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / 'SourceMeshes'
OUTPUT = ROOT / 'renders'
CONTENT = '/Game/BingoAppIcon'
TAG = unreal.Name('BingoAppIcon')
NAME = 'bingo-royale-icon'
MESH_NAME = 'SM_BingoRoyaleAppIcon'
EXECUTOR = None
QUEUE = None

# Load a private copy so asynchronous delegates cannot change the other
# fourteen assets' output directory or global render state.
_spec = importlib.util.spec_from_file_location(
    '_bingo_app_icon_shared', str(ROOT.parent / 'render_unreal.py'))
studio = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = studio
_spec.loader.exec_module(studio)
studio.CONTENT = CONTENT
studio.OUTPUT = OUTPUT


def spawn(actor_class, label, position, rotation=None):
    actor = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(
        actor_class, unreal.Vector(*position), rotation or unreal.Rotator())
    if actor is None:
        raise RuntimeError('Could not spawn ' + label)
    actor.set_actor_label(label)
    actor.set_editor_property('tags', [TAG])
    return actor


# Lights made with the shared helper receive this icon's ownership tag too.
studio.spawn = spawn


def import_subject(manifest):
    """Import each source once and assign its exact named PBR slots.

    A content-addressed asset avoids legacy FBX reimport applying coordinate
    conversion repeatedly to an already converted mesh.
    """
    entry = manifest.get('mesh', manifest)
    if isinstance(entry, str):
        entry = {'fbx': entry}
    if 'assets' in manifest:
        entry = manifest['assets'][0]
    filename = SOURCES / entry.get('fbx', MESH_NAME + '.fbx')
    if not filename.is_file():
        raise FileNotFoundError(str(filename))
    materials = {}
    for name, params in manifest['materials'].items():
        materials[name] = studio.make_material(
            name, params['base_color'], params.get('metallic', 0.0),
            params.get('roughness', .3), params.get('coat', .0),
            params.get('coat_roughness', .16))

    options = unreal.FbxImportUI()
    studio.set_properties(options, import_mesh=True, import_materials=False,
                          import_textures=False, import_as_skeletal=False,
                          automated_import_should_detect_type=False,
                          mesh_type_to_import=unreal.FBXImportType.FBXIT_STATIC_MESH)
    data = options.get_editor_property('static_mesh_import_data')
    studio.set_properties(data, combine_meshes=True, convert_scene=True,
                          convert_scene_unit=True, force_front_x_axis=True,
                          import_uniform_scale=1.0,
                          normal_import_method=unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS)
    import hashlib
    source_hash = hashlib.sha256(filename.read_bytes()).hexdigest()
    if source_hash != manifest['sha256']:
        raise RuntimeError('FBX does not match the Blender source receipt')
    asset_name = MESH_NAME + '_' + source_hash[:12] + '_FrontX'
    asset_path = CONTENT + '/Meshes/' + asset_name
    mesh = unreal.load_asset(asset_path) if unreal.EditorAssetLibrary.does_asset_exist(asset_path) else None
    task = None
    if mesh is None:
        task = unreal.AssetImportTask()
        studio.set_properties(task, filename=str(filename), destination_path=CONTENT + '/Meshes',
                              destination_name=asset_name, automated=True, replace_existing=False,
                              save=True, options=options, factory=unreal.FbxFactory())
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        mesh = unreal.load_asset(asset_path)
    if mesh is None and task is not None:
        mesh = next((asset for asset in
                     (unreal.load_asset(p) for p in task.get_editor_property('imported_object_paths'))
                     if isinstance(asset, unreal.StaticMesh)), None)
    if mesh is None:
        raise RuntimeError('FBX import did not produce the app-icon StaticMesh')
    slots = entry.get('material_slots', manifest.get('material_slots', list(materials)))
    assigned = []
    for index, slot in enumerate(mesh.get_editor_property('static_materials')):
        names = [str(slot.get_editor_property(p)) for p in
                 ('imported_material_slot_name', 'material_slot_name')]
        canonical = next((name for name in materials if name in names), None)
        if canonical is None:
            canonical = next((name for name in materials if any(name in n for n in names)), None)
        if canonical is None and index < len(slots):
            canonical = slots[index]
        if canonical not in materials:
            raise RuntimeError('Unmapped icon material slot: ' + repr(names))
        mesh.set_material(index, materials[canonical])
        assigned.append(canonical)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    studio.report('imported', mesh=mesh.get_path_name(), material_slots=assigned)
    return mesh


def make_background(exposure):
    """A rendered opaque navy backing fills the square outside the plaque."""
    name = 'M_BRI_FullBleedNavy'
    path = CONTENT + '/Materials/' + name
    material = unreal.load_asset(path)
    if material is None:
        material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name, CONTENT + '/Materials', unreal.Material, unreal.MaterialFactoryNew())
    material.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    material.set_editor_property('two_sided', True)
    material.set_editor_property('use_material_attributes', False)
    edit = unreal.MaterialEditingLibrary
    edit.delete_all_material_expressions(material)
    color = edit.create_material_expression(material, unreal.MaterialExpressionConstant3Vector, 0, 0)
    # Counter the locked exposure so the full-bleed background remains navy.
    linear = studio.linear_hex('#080d26')
    gain = 2.0 ** -exposure
    color.set_editor_property('constant', unreal.LinearColor(*[v * gain for v in linear], 1.0))
    if not edit.connect_material_property(color, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR):
        raise RuntimeError('Could not connect the opaque icon background')
    edit.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    plane = unreal.load_asset('/Engine/BasicShapes/Plane.Plane')
    if plane is None:
        raise RuntimeError('Engine background plane is unavailable')
    actor = spawn(unreal.StaticMeshActor, 'Opaque navy full-bleed backing', (-65, 0, 0),
                  unreal.Rotator(pitch=90.0, yaw=0.0, roll=0.0))
    component = actor.get_component_by_class(unreal.StaticMeshComponent)
    component.set_static_mesh(plane)
    component.set_material(0, material)
    component.set_editor_property('cast_shadow', False)
    actor.set_actor_scale3d(unreal.Vector(4, 4, 4))


def build_scene(mesh, exposure=-5.0, ortho_width=106.0):
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    map_path = CONTENT + '/Maps/Studio_AppIcon'
    if unreal.EditorAssetLibrary.does_asset_exist(map_path):
        if not levels.load_level(map_path):
            raise RuntimeError('Could not load app-icon map')
        actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        for actor in actors.get_all_level_actors():
            if TAG in actor.get_editor_property('tags'):
                actors.destroy_actor(actor)
    elif not levels.new_level(map_path):
        raise RuntimeError('Could not create app-icon map')

    subject = spawn(unreal.StaticMeshActor, 'Original crowned Bingo Royale ball', (0, 0, 0))
    subject.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(mesh)
    bounds = mesh.get_bounds()
    if bounds.box_extent.x >= bounds.box_extent.y * .8:
        raise RuntimeError('Imported icon is sideways: expected the shallow depth axis to be +X')
    largest = max(bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z) * 2.0
    if largest <= .0001:
        raise RuntimeError('App-icon mesh bounds are empty')
    factor = 100.0 / largest
    subject.set_actor_scale3d(unreal.Vector(factor, factor, factor))
    subject.set_actor_location(unreal.Vector(-bounds.origin.x * factor,
                                            -bounds.origin.y * factor,
                                            -bounds.origin.z * factor), False, False)
    make_background(exposure)

    studio.rect_light('Key - warm softbox 5000K', (210, 170, 190), 2100, (220, 260), 5000)
    for label, position, lumens, size, temperature in [
        ('Fill - cool bounce 7000K', (180, -130, -100), 420, (300, 300), 7000),
        ('Rim - blue edge 6500K', (-40, -125, 135), 650, (100, 160), 6500),
        ('Gold - broad reflection 5500K', (280, 85, 120), 600, (250, 200), 5500),
    ]:
        light = studio.rect_light(label, position, lumens, size, temperature)
        light.get_component_by_class(unreal.RectLightComponent).set_cast_shadows(False)

    position = (400, 0, 0)
    rotation = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*position), unreal.Vector(0, 0, 0))
    camera = spawn(unreal.CameraActor, 'App-icon orthographic camera', position, rotation)
    camera_component = camera.get_component_by_class(unreal.CameraComponent)
    studio.set_properties(camera_component,
                          projection_mode=unreal.CameraProjectionMode.ORTHOGRAPHIC,
                          ortho_width=float(ortho_width), aspect_ratio=1.0,
                          constrain_aspect_ratio=False, post_process_blend_weight=1.0,
                          post_process_settings=studio.studio_post_process(exposure))
    if not levels.save_current_level():
        raise RuntimeError('Could not save app-icon map')

    sequence_name = 'Render_AppIcon'
    sequence_path = CONTENT + '/Sequences/' + sequence_name
    # This generated sequence belongs exclusively to the icon studio.
    if unreal.EditorAssetLibrary.does_asset_exist(sequence_path):
        unreal.EditorAssetLibrary.delete_asset(sequence_path)
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        sequence_name, CONTENT + '/Sequences', unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(24, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(1)
    binding = sequence.add_possessable(camera)
    track = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    section = track.add_section()
    section.set_start_frame(-64)
    section.set_end_frame(1)
    binding_id = unreal.MovieSceneObjectBindingID()
    binding_id.set_editor_property('guid', binding.get_id())
    section.set_editor_property('camera_binding_id', binding_id)
    unreal.EditorAssetLibrary.save_loaded_asset(sequence)
    return {'name': NAME, 'map': map_path, 'sequence': sequence_path}


def render_job(entry, resolution, samples):
    """Use a private queue instead of erasing the editor's existing jobs."""
    global QUEUE, EXECUTOR
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    if subsystem.is_rendering():
        raise RuntimeError('Another Movie Render Queue job is already running')
    QUEUE = unreal.MoviePipelineQueue()
    job = QUEUE.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = entry['name']
    job.map = unreal.SoftObjectPath(entry['map'])
    job.sequence = unreal.SoftObjectPath(entry['sequence'])
    job.author = 'Bingo Royale original Blender and Unreal app-icon studio'
    config = job.get_configuration()
    output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    studio.set_properties(output, output_directory=unreal.DirectoryPath(str(OUTPUT)),
                          file_name_format=NAME + '.{frame_number}',
                          output_resolution=unreal.IntPoint(resolution, resolution),
                          use_custom_playback_range=True, custom_start_frame=0, custom_end_frame=1,
                          zero_pad_frame_numbers=4, override_existing_output=True)
    deferred = config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    deferred.set_editor_property('accumulator_includes_alpha', True)
    config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    aa = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    studio.set_properties(aa, spatial_sample_count=samples, temporal_sample_count=1,
                          override_anti_aliasing=True,
                          anti_aliasing_method=unreal.AntiAliasingMethod.AAM_NONE,
                          use_camera_cut_for_warm_up=False, engine_warm_up_count=64,
                          render_warm_up_count=64, render_warm_up_frames=True)
    config.find_or_add_setting_by_class(unreal.MoviePipelineColorSetting).set_editor_property(
        'disable_tone_curve', False)
    config.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
    variables = config.find_or_add_setting_by_class(unreal.MoviePipelineConsoleVariableSetting)
    for variable, value in {
        'r.PostProcessing.PropagateAlpha': 1.0, 'r.ScreenPercentage': 100.0,
        'r.MotionBlurQuality': 0.0, 'r.Lumen.HardwareRayTracing': 0.0,
        'sg.GlobalIlluminationQuality': 4.0, 'sg.ReflectionQuality': 4.0,
        'r.Shadow.Virtual.Enable': 1.0,
        'r.Shadow.Virtual.SMRT.RayCountLocal': 16.0,
        'r.Shadow.Virtual.SMRT.SamplesPerRayLocal': 8.0,
        'r.Shadow.Virtual.SMRT.AdaptiveRayCount': 0.0,
        'r.Shadow.Virtual.SMRT.MaxRayAngleFromLight': 0.1,
    }.items():
        if not variables.add_or_update_console_variable(variable, value):
            raise RuntimeError('Could not configure render CVar ' + variable)
    EXECUTOR = unreal.MoviePipelinePIEExecutor(subsystem)
    EXECUTOR.on_executor_finished_delegate.add_callable_unique(studio.finished)
    EXECUTOR.on_executor_errored_delegate.add_callable_unique(studio.errored)
    EXECUTOR.on_individual_job_work_finished_delegate.add_callable_unique(studio.job_finished)
    studio.report('rendering', queued_jobs=[NAME], completed_jobs=[], resolution=resolution,
                  spatial_samples=samples, errors=[])
    EXECUTOR.execute(QUEUE)
    return EXECUTOR


def main(resolution=1024, samples=16, exposure=-5.0, ortho_width=106.0,
         render=True, output_directory=None):
    global OUTPUT
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    if subsystem.is_rendering() or (EXECUTOR is not None and EXECUTOR.is_rendering()):
        raise RuntimeError('Wait for the current Unreal render to finish')
    OUTPUT = Path(output_directory).resolve() if output_directory else ROOT / 'renders'
    OUTPUT.mkdir(parents=True, exist_ok=True)
    studio.OUTPUT = OUTPUT
    try:
        studio.report('starting', unreal_version=unreal.SystemLibrary.get_engine_version(),
                      output_directory=str(OUTPUT), exposure=float(exposure),
                      renderer='Unreal Movie Render Queue / software Lumen')
        manifest_path = SOURCES / 'mesh-manifest.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        mesh = import_subject(manifest)
        entry = build_scene(mesh, exposure=exposure, ortho_width=ortho_width)
        (OUTPUT / 'jobs.json').write_text(json.dumps([entry], indent=2) + '\n', encoding='utf-8')
        if render:
            return render_job(entry, int(resolution), int(samples))
        studio.report('built', assets=[NAME])
        return entry
    except Exception:
        studio.report('failed', error=traceback.format_exc())
        unreal.log_error(traceback.format_exc())
        raise


if __name__ == '__main__':
    main()
