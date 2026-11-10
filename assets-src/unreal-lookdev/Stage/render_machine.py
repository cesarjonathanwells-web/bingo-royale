"""Render the call stage's ball machine in the Bingo Royale Unreal studio.

The machine is rendered three times with the same camera and the same lights
as the power-up icons (see ../render_unreal.py):

  machine-back    the whole machine without its glass, no balls
  machine-front   only the metal and enamel in front of the globe's centre plane
  machine-glass   the front of the glass globe on its own, as a dark mirror, so
                  the studio lights leave clean highlights

prepare_stage_assets.py turns the glass render into see-through highlights,
puts the front metal over it, and writes the two layers the game uses. The game
draws live balls on a canvas between them. Meshes come from
../../blender-stage/export_machine_fbx.py. Run inside the editor:

    import runpy
    stage = runpy.run_path('/absolute/path/to/Stage/render_machine.py')
    stage['main']()

or through the project's file automation (Saved/Automation/request.json) with
{"id": ..., "script": ".../Stage/render_machine.py", "action": "build" | "render" | "all" | "materials"}.
Rendering is asynchronous: wait for renders/status.json to say "complete".
All Unreal content is confined to /Game/BingoStage.
"""
import datetime
import json
import math
import runpy
import traceback
from pathlib import Path

import unreal

HERE = Path(__file__).resolve().parent
SOURCE_MESHES = HERE / 'SourceMeshes'
OUTPUT = HERE / 'renders'
CONTENT = '/Game/BingoStage'
STUDIO = runpy.run_path(str(HERE.parent / 'render_unreal.py'))
set_properties = STUDIO['set_properties']

# Blender camera: 85 mm lens on a 36 mm sensor, 900 x 920 frame, 8.6 units back
# and 0.5 up from its target. One Blender unit is drawn as 33 cm so the machine
# stands about 100 cm tall, the size the studio lights were set up for.
RESOLUTION = (900, 920)
CM_PER_UNIT = 33.0
CAMERA = (8.6 * CM_PER_UNIT, 0.0, 0.5 * CM_PER_UNIT)
HORIZONTAL_FOV = math.degrees(2 * math.atan((18.0 * RESOLUTION[0] / RESOLUTION[1]) / 85.0))
LAYERS = {'machine-back': 'SM_BallMachine', 'machine-front': 'SM_BallMachineFront',
          'machine-glass': 'SM_MachineGlassFront'}
# Where each mesh's bounds must be centred (cm) when +X is the front and the chute points to -Y.
EXPECTED_ORIGIN = {'SM_BallMachine': (0.0, 10.5), 'SM_BallMachineFront': (56.5, 10.5),
                   'SM_MachineGlassFront': (50.0, 33.5)}

STATE = {'phase': 'idle'}
EXECUTOR = None
QUEUE = None


def report(phase, **details):
    STATE.update(phase=phase, updated_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), **details)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT / 'status.tmp.json'
    temporary.write_text(json.dumps(STATE, indent=2, default=str), encoding='utf-8')
    temporary.replace(OUTPUT / 'status.json')
    unreal.log('[BingoStage] ' + phase + ' ' + json.dumps(details, default=str))


def glass_material(reflectance=0.06, roughness=0.07):
    """The glass, rendered as a dark mirror.

    Translucent materials in the deferred renderer did not pick up the studio's
    rect lights, so the globe is rendered opaque and black with a neutral
    mirror layer. Everything it shows is a reflection; prepare_stage_assets.py
    converts that brightness into see-through highlights. Real glass mirrors
    about 4% of a light, which is invisible at this exposure, so the
    reflectance is raised until the softboxes read clearly.
    """
    name = 'M_MachineGlass'
    path = CONTENT + '/Materials/' + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        material = unreal.load_asset(path)
    else:
        material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name, CONTENT + '/Materials', unreal.Material, unreal.MaterialFactoryNew())
    set_properties(material, blend_mode=unreal.BlendMode.BLEND_OPAQUE,
                   shading_model=unreal.MaterialShadingModel.MSM_DEFAULT_LIT,
                   two_sided=False, use_material_attributes=False)
    edit = unreal.MaterialEditingLibrary
    edit.delete_all_material_expressions(material)

    def constant(value, prop, y):
        node = edit.create_material_expression(material, unreal.MaterialExpressionConstant, -300, y)
        node.set_editor_property('r', float(value))
        if not edit.connect_material_property(node, '', prop):
            raise RuntimeError('Could not connect glass input ' + str(prop))

    colour = edit.create_material_expression(material, unreal.MaterialExpressionConstant3Vector, -300, -200)
    colour.set_editor_property('constant', unreal.LinearColor(reflectance, reflectance, reflectance * 1.06, 1.0))
    edit.connect_material_property(colour, '', unreal.MaterialProperty.MP_BASE_COLOR)
    constant(1.0, unreal.MaterialProperty.MP_METALLIC, -80)
    constant(roughness, unreal.MaterialProperty.MP_ROUGHNESS, 80)
    edit.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def import_mesh(name, materials):
    destination = CONTENT + '/Meshes/' + name
    filename = SOURCE_MESHES / (name + '.fbx')
    if not filename.is_file():
        raise FileNotFoundError('Run blender-stage/export_machine_fbx.py first: ' + str(filename))
    # Re-importing over an existing asset has come back turned a quarter; always import fresh.
    if unreal.EditorAssetLibrary.does_asset_exist(destination):
        unreal.EditorAssetLibrary.delete_asset(destination)
    options = unreal.FbxImportUI()
    set_properties(options, import_mesh=True, import_materials=False, import_textures=False,
                   import_as_skeletal=False, automated_import_should_detect_type=False,
                   mesh_type_to_import=unreal.FBXImportType.FBXIT_STATIC_MESH)
    data = options.get_editor_property('static_mesh_import_data')
    set_properties(data, combine_meshes=True, convert_scene=True, convert_scene_unit=True,
                   force_front_x_axis=True, import_uniform_scale=1.0,
                   normal_import_method=unreal.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS)
    task = unreal.AssetImportTask()
    set_properties(task, filename=str(filename), destination_path=CONTENT + '/Meshes',
                   destination_name=name, automated=True, replace_existing=True,
                   save=True, options=options, factory=unreal.FbxFactory())
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    mesh = unreal.load_asset(destination)
    if not isinstance(mesh, unreal.StaticMesh):
        raise RuntimeError('FBX import produced no StaticMesh for ' + name)
    slots = []
    for index, slot in enumerate(mesh.get_editor_property('static_materials')):
        label = str(slot.get_editor_property('imported_material_slot_name'))
        match = next((m for m in materials if m in label), None)
        if match is None:
            raise RuntimeError('Unmapped material slot {} on {}'.format(label, name))
        mesh.set_material(index, materials[match])
        slots.append(label)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    bounds = mesh.get_bounds()
    # +X must be the front and the chute must point to -Y (camera right).
    expected = EXPECTED_ORIGIN[name]
    if abs(bounds.origin.x - expected[0]) > 2 or abs(bounds.origin.y - expected[1]) > 2:
        raise RuntimeError('{} imported in the wrong orientation: origin {}'.format(name, bounds.origin))
    return mesh, {'slots': slots,
                  'origin_cm': [round(v, 1) for v in (bounds.origin.x, bounds.origin.y, bounds.origin.z)],
                  'extent_cm': [round(v, 1) for v in (bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z)]}


def build_layer(layer, mesh, exposure):
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    map_path = CONTENT + '/Maps/Studio_' + layer.replace('-', '_')
    if unreal.EditorAssetLibrary.does_asset_exist(map_path):
        if not levels.load_level(map_path):
            raise RuntimeError('Could not load ' + map_path)
        for actor in actors.get_all_level_actors():
            if unreal.Name('BingoLookdev') in actor.get_editor_property('tags'):
                actors.destroy_actor(actor)
    elif not levels.new_level(map_path):
        raise RuntimeError('Could not create ' + map_path)

    subject = STUDIO['spawn'](unreal.StaticMeshActor, layer, (0, 0, 0))
    component = subject.get_component_by_class(unreal.StaticMeshComponent)
    component.set_static_mesh(mesh)
    scale = CM_PER_UNIT / 100.0  # the FBX arrives at 100 cm per Blender unit
    subject.set_actor_scale3d(unreal.Vector(scale, scale, scale))

    # The icon studio: +X is the front, the key is high on camera-left.
    light = STUDIO['rect_light']
    light('Key - warm upper-left 5000K', (210, 170, 190), 2100, (120, 180), 5000)
    light('Fill - cool lower bounce 7000K', (180, -130, -115), 400, (300, 300), 7000)
    light('Rim - cool silhouette 6500K', (-145, -95, 125), 550, (140, 160), 6500)
    light('Front - broad gold reflection', (300, 100, 130), 750, (300, 250), 5500)

    rotation = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*CAMERA), unreal.Vector(0, 0, 0))
    camera = STUDIO['spawn'](unreal.CameraActor, 'Stage camera', CAMERA, rotation)
    lens = camera.get_component_by_class(unreal.CameraComponent)
    post = STUDIO['studio_post_process'](exposure)
    set_properties(lens, projection_mode=unreal.CameraProjectionMode.PERSPECTIVE,
                   field_of_view=HORIZONTAL_FOV, aspect_ratio=RESOLUTION[0] / RESOLUTION[1],
                   constrain_aspect_ratio=True, post_process_blend_weight=1.0, post_process_settings=post)
    if not levels.save_current_level():
        raise RuntimeError('Could not save ' + map_path)

    sequence_name = 'Render_' + layer.replace('-', '_')
    sequence_path = CONTENT + '/Sequences/' + sequence_name
    if unreal.EditorAssetLibrary.does_asset_exist(sequence_path):
        unreal.EditorAssetLibrary.delete_asset(sequence_path)
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        sequence_name, CONTENT + '/Sequences', unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(24, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(1)
    binding = sequence.add_possessable(camera)
    section = sequence.add_track(unreal.MovieSceneCameraCutTrack).add_section()
    section.set_start_frame(-64)
    section.set_end_frame(1)
    binding_id = unreal.MovieSceneObjectBindingID()
    binding_id.set_editor_property('guid', binding.get_id())
    section.set_editor_property('camera_binding_id', binding_id)
    unreal.EditorAssetLibrary.save_loaded_asset(sequence)
    return {'name': layer, 'map': map_path, 'sequence': sequence_path}


def make_materials():
    make = STUDIO['make_material']
    return {
        # Same gold as the crown and the power-up icons.
        'M_GoldMetal': make('M_GoldMetal', [1.0, 0.56, 0.035], 1.0, 0.25, 0.0, 0.23),
        'M_MidnightEnamel': make('M_MidnightEnamel', STUDIO['linear_hex']('#242e68'), 0.0, 0.30, 0.35, 0.15),
        'M_MachineGlass': glass_material(),
    }


def build(exposure=-5.0):
    # Reloading a studio map after Movie Render Queue has used it in this editor
    # session is fatal in UE 5.8 ("World Memory Leaks"). Restart the editor first.
    if globals().get('RENDERED_THIS_SESSION'):
        raise RuntimeError('Restart the editor before rebuilding the maps; use action "materials" to change materials only')
    materials = make_materials()
    entries, meshes = [], {}
    for layer, mesh_name in LAYERS.items():
        mesh, info = import_mesh(mesh_name, materials)
        meshes[mesh_name] = info
        entries.append(build_layer(layer, mesh, exposure))
    (OUTPUT / 'jobs.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    report('built', layers=[e['name'] for e in entries], meshes=meshes,
           camera_cm=list(CAMERA), horizontal_fov=round(HORIZONTAL_FOV, 3))
    return entries


def finished(executor, success):
    report('complete' if success else 'failed', success=bool(success),
           rendered_files=sorted(str(p) for p in OUTPUT.glob('*.png')))


def errored(executor, pipeline, fatal, message):
    errors = list(STATE.get('errors', []))
    errors.append({'fatal': bool(fatal), 'message': str(message)})
    report('render_error' if fatal else 'render_warning', errors=errors)


def job_finished(params):
    report('rendering', completed_jobs=list(STATE.get('completed_jobs', [])) + [str(params.job.job_name)])


def render(entries, samples=32):
    global EXECUTOR, QUEUE
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    if subsystem.is_rendering():
        raise RuntimeError('A Movie Render Queue job is already running')
    QUEUE = subsystem.get_queue()
    QUEUE.delete_all_jobs()
    for entry in entries:
        job = QUEUE.allocate_new_job(unreal.MoviePipelineExecutorJob)
        job.job_name = entry['name']
        job.map = unreal.SoftObjectPath(entry['map'])
        job.sequence = unreal.SoftObjectPath(entry['sequence'])
        job.author = 'Bingo Royale Unreal stage studio'
        config = job.get_configuration()
        output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
        set_properties(output, output_directory=unreal.DirectoryPath(str(OUTPUT)),
                       file_name_format=entry['name'] + '.{frame_number}',
                       output_resolution=unreal.IntPoint(*RESOLUTION),
                       use_custom_playback_range=True, custom_start_frame=0, custom_end_frame=1,
                       zero_pad_frame_numbers=4, override_existing_output=True)
        deferred = config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
        deferred.set_editor_property('accumulator_includes_alpha', True)
        config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
        aa = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
        set_properties(aa, spatial_sample_count=samples, temporal_sample_count=1,
                       override_anti_aliasing=True, anti_aliasing_method=unreal.AntiAliasingMethod.AAM_NONE,
                       use_camera_cut_for_warm_up=False, engine_warm_up_count=64,
                       render_warm_up_count=64, render_warm_up_frames=True)
        colour = config.find_or_add_setting_by_class(unreal.MoviePipelineColorSetting)
        colour.set_editor_property('disable_tone_curve', False)
        config.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
        variables = config.find_or_add_setting_by_class(unreal.MoviePipelineConsoleVariableSetting)
        for variable, value in {
            'r.PostProcessing.PropagateAlpha': 1.0,
            'r.ScreenPercentage': 100.0,
            'r.MotionBlurQuality': 0.0,
            'r.Lumen.HardwareRayTracing': 0.0,
            'sg.GlobalIlluminationQuality': 4.0,
            'sg.ReflectionQuality': 4.0,
        }.items():
            if not variables.add_or_update_console_variable(variable, value):
                raise RuntimeError('Could not configure render CVar ' + variable)
    EXECUTOR = unreal.MoviePipelinePIEExecutor(subsystem)
    EXECUTOR.on_executor_finished_delegate.add_callable_unique(finished)
    EXECUTOR.on_executor_errored_delegate.add_callable_unique(errored)
    EXECUTOR.on_individual_job_work_finished_delegate.add_callable_unique(job_finished)
    report('rendering', queued_jobs=[e['name'] for e in entries], completed_jobs=[],
           resolution=list(RESOLUTION), spatial_samples=samples, errors=[])
    globals()['RENDERED_THIS_SESSION'] = True
    subsystem.render_queue_with_executor_instance(EXECUTOR)
    return EXECUTOR


def main(build_scenes=True, render_layers=True, exposure=-5.0, samples=32, materials_only=False):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    try:
        report('starting', unreal_version=unreal.SystemLibrary.get_engine_version(), exposure=exposure)
        if materials_only:
            make_materials()
            entries = json.loads((OUTPUT / 'jobs.json').read_text(encoding='utf-8'))
        elif build_scenes:
            entries = build(exposure)
        else:
            entries = json.loads((OUTPUT / 'jobs.json').read_text(encoding='utf-8'))
        if render_layers:
            return render(entries, samples)
        return entries
    except Exception:
        report('failed', error=traceback.format_exc())
        unreal.log_error(traceback.format_exc())
        raise


# File automation entry point (see ../Content/Python/init_unreal.py).
if 'REQUEST' in globals() and globals()['REQUEST'].get('script', '').endswith('render_machine.py'):
    _request = globals()['REQUEST']
    _action = _request.get('action', 'all')
    # "materials" rebuilds the three materials and renders again without touching the maps.
    main(build_scenes=_action in ('build', 'all'), render_layers=_action in ('render', 'all', 'materials'),
         exposure=float(_request.get('exposure', -5.0)), samples=int(_request.get('samples', 32)),
         materials_only=_action == 'materials')
