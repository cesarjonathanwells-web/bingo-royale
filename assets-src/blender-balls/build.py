"""Build polished versions of the existing Bingo Royale ball colors."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out=ROOT+'/apps/client/public/images/blender-balls'
os.makedirs(out,exist_ok=True)
previous=bpy.context.window.scene
s=bpy.data.scenes.new('Bingo Royale • Original ball enhancement');bpy.context.window.scene=s
s.render.engine=previous.render.engine
s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100
s.render.film_transparent=True
s.render.image_settings.file_format='PNG'
s.view_settings.view_transform='Standard'
s.world=bpy.data.worlds.new('Ball studio');s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.15,.18,.25,1);bg.inputs[1].default_value=.35
def linear(v):
 v=v/255
 return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)) for i in [1,3,5])
m=bpy.data.materials.new('Original palette • polished resin');m.use_nodes=True
bsdf=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value=.24;bsdf.inputs['Metallic'].default_value=.03
bsdf.inputs['Coat Weight'].default_value=.35;bsdf.inputs['Coat Roughness'].default_value=.19
bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64,radius=1)
ball=bpy.context.object;ball.name='Bingo ball • original proportions';ball.data.materials.append(m)
for p in ball.data.polygons:p.use_smooth=True
# Broad studio reflections on the same colored sphere; live text stays in React.
def area(name,loc,power,size,scale=(1,1,1)):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.scale=scale
 o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
area('Upper left softbox',(-3,-4,4),350,3,(1,.55,1))
area('Soft right fill',(3,-3,1),80,3)
area('Blue edge reflector',(2,2,2),180,2)
c=bpy.data.cameras.new('Front-facing UI camera');cam=bpy.data.objects.new('Front-facing UI camera',c);s.collection.objects.link(cam)
cam.location=(0,-6,0);cam.rotation_euler=(math.pi/2,0,0);c.type='ORTHO';c.ortho_scale=2.03;s.camera=cam
palette={'b':'#3b82f6','i':'#ef4444','n':'#a78bfa','g':'#22c55e','o':'#f59e0b'}
for letter,color in palette.items():
 bsdf.inputs['Base Color'].default_value=(*rgb(color),1)
 s.render.filepath=out+'/'+letter+'.png';bpy.ops.render.render(write_still=True)
bsdf.inputs['Base Color'].default_value=(*rgb(palette['b']),1)
bpy.data.libraries.write(ROOT+'/assets-src/blender-balls/original-style-balls.blend',{s},fake_user=True,compress=True)
bpy.context.window.scene=previous
print('Rendered five original-color ball surfaces and saved an isolated Blender source.')
