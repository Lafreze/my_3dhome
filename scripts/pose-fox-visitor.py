"""Rebuild the seated kitsune locally from the user-provided original GLB.
Run Blender with --background --factory-startup --python scripts/pose-fox-visitor.py.
Optional source override: STUDIO_FOX_REFERENCE. No network calls are made.
"""
from pathlib import Path
import bpy, os
ROOT=Path(__file__).resolve().parents[1]
if bpy.data.filepath or set(o.name for o in bpy.context.scene.objects)!={'Cube','Camera','Light'}:
 raise RuntimeError('Use --factory-startup to protect the current Blender document.')
for folder in ['output','assets/models','public/models']:(ROOT/folder).mkdir(parents=True,exist_ok=True)

# Preserve complete source surfaces and UVs.
import bpy,math,numpy as np
from mathutils import Matrix,Vector
scene=bpy.context.scene;scene.name='Kitsune visitor workshop'
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=os.environ.get('STUDIO_FOX_REFERENCE',str(Path.home()/'Downloads'/'Hi3D_Chibi Nine-Tailed Fox Kitsune 3D Figurine_allparts_20260908_174023.glb')))
o=next(o for o in bpy.context.selected_objects if o.type=='MESH');o.name='Original fox';o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
mod=o.modifiers.new('Retain entire reference surface','DECIMATE');mod.ratio=.036;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
print('Original fox triangles',len(o.data.polygons),'vertices',len(o.data.vertices))
world=bpy.data.worlds.new('Kitsune neutral world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.17,.18,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
for name,pos,power,size in [('Key',(-2,-3,4),280,3),('Fill',(2,-2,2),100,3),('Rim',(1,2,3),220,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Kitsune camera');cam=bpy.data.objects.new('Kitsune camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=1.22
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'

# Sample original albedo for optional tint regions.
s=bpy.data.objects['Original fox'].data
v=np.array([vertex.co[:] for vertex in s.vertices])
mat=s.materials[0];bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');im=bsdf.inputs['Base Color'].links[0].from_node.image
print('source texture',im.name,list(im.size));pixels=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4)
uv=np.array([l.uv[:] for l in s.uv_layers.active.data]);sample=pixels[np.clip((uv[:,1]*im.size[1]).astype(int),0,im.size[1]-1),np.clip((uv[:,0]*im.size[0]).astype(int),0,im.size[0]-1),:3]
ids=np.array([l.vertex_index for l in s.loops]);counts=np.bincount(ids,minlength=len(s.vertices));rgb=np.zeros((len(s.vertices),3));np.add.at(rgb,ids,sample);rgb/=np.maximum(counts[:,None],1)
reference_colors={'vertices':v,'rgb':rgb}

# Fold the body and fan without cutting joint seams.
import bpy,numpy as np,math
from mathutils import Vector
scene=bpy.context.scene;assert scene.name=='Kitsune visitor workshop'
root=str(ROOT)
source=bpy.data.objects['Original fox'];source.hide_render=True;source.hide_set(True)
old=bpy.data.objects.get('Seated fox')
if old:bpy.data.objects.remove(old,do_unlink=True)
ob=source.copy();ob.data=source.data.copy();scene.collection.objects.link(ob);ob.name='Seated fox';ob.hide_set(False);ob.hide_render=False
m=ob.data;arr=np.empty(len(m.vertices)*3,np.float32);m.vertices.foreach_get('co',arr);v=arr.reshape(-1,3);x,y,z=v.T

def smooth(a,b,t):
 t=np.clip((t-a)/(b-a),0,1);return t*t*(3-2*t)
def rx(v,a,p):
 o=v.copy();dy=v[:,1]-p[1];dz=v[:,2]-p[2];o[:,1]=np.cos(a)*dy-np.sin(a)*dz+p[1];o[:,2]=np.sin(a)*dy+np.cos(a)*dz+p[2];return o
hip=-.225;top=-.155;length=.105;angle=math.radians(78);radius=length/angle;knee=-.365;contact=-.236;scale=1.15
s=np.maximum(0,top-z);phi=np.minimum(s/length,1)*angle;extra=np.maximum(0,s-length)
cy=-.04-radius*(1-np.cos(phi))-extra*math.sin(angle);cz=top-radius*np.sin(phi)-extra*math.cos(angle)
lower=v.copy();lower[:,1]=cy+(y+.04)*np.cos(phi);lower[:,2]=cz-(y+.04)*np.sin(phi);lower[z>=top]=v[z>=top]
ks=top-knee;ky=-.04-radius*(1-math.cos(angle))-(ks-length)*math.sin(angle);kz=top-radius*math.sin(angle)-(ks-length)*math.cos(angle)
lower=rx(lower,math.radians(8)*(1-smooth(knee-.018,knee+.025,z)),(0,ky,kz))
arm=np.maximum(smooth(.07,.115,abs(x)),1-smooth(-.20,-.14,y))*(1-smooth(-.065,-.025,z))*(1-smooth(.295,.325,-z))
arms=rx(v,math.radians(-12)*(1-smooth(-.095,-.025,z)),(0,-.10,-.03));arms[:,2]-=.025*(1-smooth(-.09,-.025,z))
out=lower*(1-arm[:,None])+arms*arm[:,None]
# A compact upright tail fan, entirely above the seat and inside the backrest clearance.
tail=np.maximum(smooth(.075,.135,y),smooth(.16,.235,abs(x))*smooth(-.035,.025,y))
# The ears, face and upper crown of hair are never included in the tail fold.
tail=np.maximum(tail,smooth(-.05,-.015,y)*(1-smooth(-.20,-.13,z)))
tail*=1-smooth(.315,.37,z)
fold=v.copy();fold[:,0]*=.41;fold[:,1]=.095+(y-.08)*.28;fold[:,2]=np.maximum(contact+.022,-.09+(z+.16)*.6)
out=out*(1-tail[:,None])+fold*tail[:,None]
# Keep the embroidered hem over the upper thighs, with no sharp hip crease.
skirt=(1-smooth(-.16,-.10,y))*smooth(.20,.275,-z)*(1-smooth(.28,.305,-z))*(1-arm)*(1-tail)
out[:,1]-=.06*skirt;out[:,2]-=.025*skirt
back=smooth(-.18,-.025,out[:,1])*(1-smooth(hip-.02,hip+.02,z))*(1-arm)
out[:,2]+=np.maximum(0,contact+.003-out[:,2])*back
out[:,2]=(out[:,2]-contact)*scale;out[:,:2]*=scale
m.vertices.foreach_set('co',out.astype(np.float32).ravel());m.update()
for f in m.polygons:f.use_smooth=True
ob['character']='fox';ob['pose']='continuous seated body with compact upright nine-tail fan';ob['seatScale']=scale
for name,weights in [('Tail fold',tail),('Sleeves and clasped hands',arm),('Hem drape',skirt)]:
 group=ob.vertex_groups.new(name=name)
 for i,w in enumerate(weights):
  if w>.001:group.add([i],float(w),'REPLACE')
print('Posed bounds',out.min(0).tolist(),out.max(0).tolist(),'tail vertex count',int((tail>.8).sum()))
for o in list(scene.objects):
 if o.name.startswith('Pose preview'):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,.035,-.035));seat=bpy.context.object;seat.name='Pose preview seat';seat.scale=(.6,.53,.055)
scene.camera.data.ortho_scale=1.4
for view,pos in [('front',(0,-3,.55)),('side',(3,0,.5)),('threequarter',(1.7,-3,1.3)),('back',(0,3,.65))]:
 target=Vector((0,-.1,.4));scene.camera.location=pos;scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=root+'/output/fox-seated-'+view+'.png';bpy.ops.render.render(write_still=True)
print('Seated fox previews complete')

# Export an independent web copy and editable source.
import bpy,numpy as np,os
from mathutils import Vector
scene=bpy.context.scene;assert scene.name=='Kitsune visitor workshop'
root=str(ROOT)
original=bpy.data.objects['Seated fox'];original.hide_render=True;original.hide_set(True)
old=bpy.data.objects.get('Web fox')
if old:bpy.data.objects.remove(old,do_unlink=True)
ob=original.copy();ob.data=original.data.copy();scene.collection.objects.link(ob);ob.name='Web fox';ob.hide_render=False;ob.hide_set(False);m=ob.data
source=reference_colors;v=source['vertices'];rgb=source['rgb'];ids=np.array([list(p.vertices) for p in m.polygons]);centers=v[ids].mean(1);rgb=rgb[ids].mean(1);x,y,z=centers.T;r,g,b=rgb.T
ornament=(((x-.15)/.072)**2+((z-.235)/.10)**2<1)&(y<-.15)
hair=(z>-.165)&(y<.115)&(abs(x)<.27)&(g>.32)&(b>r*.95)&(~ornament)
eye=(((abs(x)-.065)/.029)**2+((z-.124)/.027)**2<1)&(y<-.19)&(r>.2)&(r>g*1.2)&(b>g*1.09)
cloth=(r<.31)&(g<.25)&(b<.28)&(r<g*1.6)&(y<.07)&(abs(x)<.20)
top=cloth&(z>-.23)&(z<.014)
bottom=cloth&(z<-.23)&(z>-.31)&(abs(x)<.10)
category=np.zeros(len(ids),np.int32)
for index,mask in enumerate([hair,eye,top,bottom],1):category[mask]=index
base=m.materials[0];m.materials.clear();copies={}
for name in ['Original','TintHair','TintEyes','TintTop','TintBottom']:
 mat=base.copy();mat.name='fox_'+name
 for n in mat.node_tree.nodes:
  if n.type=='TEX_IMAGE' and n.image:
   source_image=n.image
   if source_image.name not in copies:
    image=source_image.copy();image.name='fox web '+source_image.name;image.scale(2048,2048);image.pack();copies[source_image.name]=image
   n.image=copies[source_image.name]
 m.materials.append(mat)
m.polygons.foreach_set('material_index',category)
print('Color region faces',np.bincount(category,minlength=5).tolist())
bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
mod=ob.modifiers.new('Web silhouette budget','DECIMATE');mod.ratio=.56;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
ob['sourceFile']='Hi3D_Chibi Nine-Tailed Fox Kitsune 3D Figurine_allparts_20260908_174023.glb'
ob['tailPose']='Compact nine-tail fan; full original mesh retained; tail tips clear the seat.'
bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor-fox-v3.glb',export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_image_format='JPEG',export_jpeg_quality=92)
print('Web triangles',len(m.polygons),'bytes',os.path.getsize(root+'/public/models/studio-visitor-fox-v3.glb'))
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.camera.data.ortho_scale=1.35
scene.camera.location=(1.7,-3,1.15);scene.camera.rotation_euler=(Vector((0,-.10,.39))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=root+'/output/fox-final-seated.png';bpy.ops.render.render(write_still=True)
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitor-fox-v3.blend',compress=True)
print('Editable fox source saved')
