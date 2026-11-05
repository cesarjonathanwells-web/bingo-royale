"""Render dimensional versions of the game's existing icon silhouettes."""
import bpy,math,os,sys
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out=ROOT+'/apps/client/public/images/blender-icons';os.makedirs(out,exist_ok=True)
previous = bpy.context.window.scene
previous_layer = bpy.context.window.view_layer
previous_active = previous_layer.objects.active
previous_selected = tuple(bpy.context.selected_objects)
try:
    s = bpy.data.scenes.new('Bingo Royale • Collectible icon studio')
    bpy.context.window.scene = s
    # Shared with the ball studio: deterministic CPU rendering and controlled color.
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 64
    s.cycles.use_denoising = True
    s.cycles.seed = 21
    s.cycles.use_animated_seed = False
    s.render.resolution_x = 192
    s.render.resolution_y = 192
    s.render.resolution_percentage = 100
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.image_settings.color_depth = '8'
    s.render.image_settings.compression = 80
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'None'
    s.view_settings.exposure = 0
    s.view_settings.gamma = 1
    s.world = bpy.data.worlds.new('Icon studio • restrained cool ambience')
    s.world.use_nodes = True
    background = next(node for node in s.world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (.15, .18, .25, 1)
    background.inputs['Strength'].default_value = .15


    def mat(name, color, metallic=0, roughness=.30, coat=.20):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Metallic'].default_value = metallic
        shader.inputs['Roughness'].default_value = roughness
        shader.inputs['Coat Weight'].default_value = coat
        shader.inputs['Coat Roughness'].default_value = .23
        return material


    # Actual metal is separated from nonmetallic enamel/resin and satin skin.
    gold = mat('Gold • polished metal', (1, .56, .035), metallic=1, roughness=.25, coat=0)
    purple = mat('Lilac • enamel', (.42, .20, .80))
    blue = mat('Blue • enamel', (.04, .30, .90))
    white = mat('Pearl • enamel', (.82, .82, .86), roughness=.32)
    red = mat('Red • enamel', (.90, .06, .10))
    ink = mat('Pupil • dark resin', (.012, .018, .035), roughness=.32)
    skin = mat('Victory hand • satin resin', (.95, .56, .19), roughness=.38, coat=.08)
    objects=[]
    def finish(o,m):
     o.data.materials.append(m);objects.append(o)
     if o.type=='MESH':
      for p in o.data.polygons:p.use_smooth=True
     return o
    def poly(name,pts,m,depth=.18):
     n=len(pts);verts=[(x,y,z) for y in [-depth/2,depth/2] for x,z in pts]
     faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
     mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);s.collection.objects.link(o)
     mod=o.modifiers.new('Soft dimensional edge','BEVEL');mod.width=.055;mod.segments=4;return finish(o,m)
    def sphere(name,loc,scale,m):
     bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;return finish(o,m)
    def tube(name,pts,m,r=.06):
     c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=4;sp=c.splines.new('POLY');sp.points.add(len(pts)-1)
     for p,co in zip(sp.points,pts):p.co=(*co,1)
     o=bpy.data.objects.new(name,c);s.collection.objects.link(o);return finish(o,m)
    def ring(name,r,m,y=0,scale=(1,1,1)):
     bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,major_radius=r,minor_radius=.07,rotation=(math.pi/2,0,0),location=(0,y,0));o=bpy.context.object;o.name=name;o.scale=scale;return finish(o,m)
    def star():
     return [(math.sin(a)*r,math.cos(a)*r) for i in range(10) for a,r in [(i*math.pi/5,.85 if i%2==0 else .39)]]
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
            light.color = {5000: (1, .790, .628), 6500: (1, 1, 1), 7000: (.900, .935, 1)}[temperature]
        obj = bpy.data.objects.new(name, light)
        s.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()


    area('Key • upper-left softbox • 5000 K', (-3, -4, 4), 350, 3, 5000, 1.65)
    area('Fill • cool right bounce • 7000 K', (3, -3, 1), 40, 3, 7000)
    area('Rim • soft silhouette separation', (2, 2, 2), 60, 3, 6500)
    # A broad frontal reflection gives true-metal faces a readable reflection,
    # rather than adding diffuse color or emissive paint to the gold material.
    area('Front reflection card • gold readability', (0, -4, 1), 150, 4, 6500, 3)
    c=bpy.data.cameras.new('Icon camera');cam=bpy.data.objects.new('Icon camera',c);s.collection.objects.link(cam);cam.location=(.24,-5,.16);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();c.type='ORTHO';c.ortho_scale=2.15;s.camera=cam
    names = ['wild_square'] if '--preview' in sys.argv else ['wild_square','shield','turbo_stamp','ink_blot','number_peek','scramble','callers_choice','double_daub','crown']
    for name in names:
     objects=[]
     if name=='wild_square':poly(name,star(),gold)
     elif name=='shield':
      shape=[(-.7,.7),(0,.88),(.7,.7),(.62,-.3),(0,-.9),(-.62,-.3)]
      poly(name,shape,blue);poly('Shield crest',[(x*.7,z*.7) for x,z in shape],gold,.24)
     elif name=='turbo_stamp':poly(name,[(-.06,.95),(-.7,-.08),(-.15,-.08),(-.32,-.95),(.68,.25),(.14,.25),(.35,.95)],gold)
     elif name=='ink_blot':
      pts=[]
      for i in range(96):
       t=math.tau*i/96;pts.append((16*math.sin(t)**3/19,(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))/19))
      n=len(pts)
      verts=[(x,y,z) for y in [-.09,.09] for x,z in pts]+[(0,-.23,-.08)]
      faces=[(2*n,(i+1)%n,i) for i in range(n)]+[tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
      mesh=bpy.data.meshes.new('Rounded heart relief');mesh.from_pydata(verts,[],faces);mesh.update()
      heart=bpy.data.objects.new(name,mesh);s.collection.objects.link(heart);finish(heart,purple)
      bevel=heart.modifiers.new('Soft enamel edge','BEVEL');bevel.width=.025;bevel.segments=3
     elif name=='number_peek':
      ring('Eye',.7,white,scale=(1,.58,1));sphere('Iris',(0,-.12,0),(.31,.13,.31),blue);sphere('Pupil',(0,-.24,0),(.15,.05,.15),ink);sphere('Eye glint',(-.06,-.3,.08),(.05,.02,.05),white)
     elif name=='scramble':
      pts=[]
      for i in range(140):
       a=i/139*math.tau*2.4;r=.08+.76*i/139;pts.append((r*math.cos(a),-.03*i/139,r*math.sin(a)))
      tube(name,pts,blue,.085)
     elif name=='callers_choice':
      for r,m in [(.78,red),(.53,white),(.28,red)]:ring('Target ring',r,m)
      sphere('Bullseye',(0,-.05,0),(.11,.1,.11),gold)
     elif name=='double_daub':
      sphere('Palm',(0,0,-.3),(.4,.16,.45),skin)
      tube('Index finger',[(-.15,0,-.1),(-.31,0,.78)],skin,.12);sphere('Index tip',(-.31,0,.78),(.12,.12,.12),skin)
      tube('Middle finger',[(.1,0,-.1),(.33,0,.85)],skin,.12);sphere('Middle tip',(.33,0,.85),(.12,.12,.12),skin)
      sphere('Folded fingers',(.25,-.15,-.28),(.18,.12,.22),skin);sphere('Thumb',(-.18,-.19,-.42),(.28,.1,.14),skin)
     elif name=='crown':
      poly('Original crown',[(-.84,.58),(-.4,.18),(0,.88),(.4,.18),(.84,.58),(.6,-.47),(-.6,-.47)],gold)
      poly('Crown band',[(-.68,-.42),(.68,-.42),(.68,-.64),(-.68,-.64)],gold,.22)
      for x,m in [(-.43,red),(0,blue),(.43,purple)]:sphere('Crown gemstone',(x,-.15,-.52),(.075,.05,.075),m)
     s.render.filepath=out+'/'+name+'.png';bpy.ops.render.render(write_still=True)
     # Retain models in organized collections; hide earlier icons from subsequent renders.
     collection=bpy.data.collections.new('Icon • '+name);s.collection.children.link(collection)
     for o in objects:
      for coll in list(o.users_collection):coll.objects.unlink(o)
      collection.objects.link(o);o.hide_render=True
    if '--preview' not in sys.argv:
     for o in s.objects:
      if o.type not in ['LIGHT','CAMERA']:o.hide_render=False
     collections=[c for c in s.collection.children if c.name.startswith('Icon • ')]
     for i,collection in enumerate(collections):
      for o in collection.objects:o.location+=Vector(((i%3-1)*2.4,0,(1-i//3)*2.4))
     cam.location=(0,-12,0);cam.rotation_euler=(math.pi/2,0,0);c.ortho_scale=7.5
     s.render.resolution_x=900;s.render.resolution_y=900;s.render.filepath=ROOT+'/assets-src/blender-balls/icon-gallery.png'
     bpy.ops.render.render(write_still=True)
    bpy.data.libraries.write(ROOT+'/assets-src/blender-balls/original-style-icons.blend',{s},fake_user=True,compress=True)
    print('Rendered ' + ('one gold-star preview' if '--preview' in sys.argv else 'eight power-ups, the crown, and the gallery') + ' and saved the editable studio.')
finally:
    # Restore the artist's previous scene, view layer, active object and selection.
    bpy.context.window.scene = previous
    bpy.context.window.view_layer = previous_layer
    for obj in previous_layer.objects:
        obj.select_set(obj in previous_selected)
    previous_layer.objects.active = previous_active
