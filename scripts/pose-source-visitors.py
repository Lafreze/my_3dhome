"""Rebuild both intact, seated visitor derivatives locally with Blender 5.x.

Run in a fresh factory-startup document:
  blender --background --factory-startup --python scripts/pose-source-visitors.py
Optional source overrides: STUDIO_BEAR_REFERENCE and STUDIO_CAT_REFERENCE.
The user's original GLBs are read-only inputs. No network requests are made.
"""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
if bpy.data.filepath or set(o.name for o in bpy.context.scene.objects)!={'Cube','Camera','Light'}:
 raise RuntimeError('Run with --factory-startup to protect the current Blender document.')
(ROOT/'output').mkdir(exist_ok=True)
(ROOT/'assets/models').mkdir(parents=True,exist_ok=True)
(ROOT/'public/models').mkdir(parents=True,exist_ok=True)

# Import complete reference surfaces.
import bpy,os,math,numpy as np
from mathutils import Vector,Matrix
scene=bpy.context.scene;scene.name='Visitor source pose workshop'
# Fresh factory-startup document, independent of all saved visitor versions.
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
root=str(ROOT)
for kind,file in [('bear','Hi3D_Stylized Chibi Bear Girl 3D Character_allparts_20260908_150541.glb'),('cat','Hi3D_Stylized Chibi Punk Catgirl 3D Figurine_allparts_20260908_163305.glb')]:
 bpy.ops.import_scene.gltf(filepath=os.environ.get('STUDIO_'+kind.upper()+'_REFERENCE',str(Path.home()/'Downloads'/file)))
 o=next(x for x in bpy.context.selected_objects if x.type=='MESH');o.name='Original '+kind
 o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Preserve complete silhouette and UVs','DECIMATE');mod.ratio=.075;bpy.ops.object.modifier_apply(modifier=mod.name)
 o['sourceKind']=kind;o.hide_render=True
 print(kind,'triangles',len(o.data.polygons),'bounds',[(min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)) for i in range(3)])
world=bpy.data.worlds.new('Neutral portrait world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.17,.18,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
for name,pos,power,size in [('Key',(-2,-3,4),280,3),('Fill',(2,-2,2),100,3),('Rim',(1,2,3),220,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Source camera');cam=bpy.data.objects.new('Source camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=1.15
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=680;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'

# Analyze source UV colors for optional recoloring.
appearance_data={}
for kind in ['bear','cat']:
 m=bpy.data.objects['Original '+kind].data
 mat=m.materials[0];bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 node=bsdf.inputs['Base Color'].links[0].from_node;im=node.image
 print(kind,im.name,list(im.size))
 pixels=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4)
 uv=np.array([l.uv[:] for l in m.uv_layers.active.data]);sample=pixels[np.clip((uv[:,1]*im.size[1]).astype(int),0,im.size[1]-1),np.clip((uv[:,0]*im.size[0]).astype(int),0,im.size[0]-1),:3]
 indices=np.array([l.vertex_index for l in m.loops]);counts=np.bincount(indices,minlength=len(m.vertices));rgb=np.zeros((len(m.vertices),3));np.add.at(rgb,indices,sample);rgb/=np.maximum(counts[:,None],1)
 arr=np.array([vertex.co[:] for vertex in m.vertices]);appearance_data[kind]={'vertices':arr,'rgb':rgb}

# Pose the continuous source mesh without detached joint pieces.
import bpy,math,numpy as np
from mathutils import Vector,Matrix
scene=bpy.context.scene
assert scene.name=='Visitor source pose workshop'
root=str(ROOT)
def smooth(a,b,v):
 t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
def rotate_x(v,angle,pivot):
 out=v.copy();y=v[:,1]-pivot[1];z=v[:,2]-pivot[2];c=np.cos(angle);s=np.sin(angle);out[:,1]=c*y-s*z+pivot[1];out[:,2]=s*y+c*z+pivot[2];return out
for kind in ['bear','cat']:
 old=bpy.data.objects.get('Seated '+kind)
 if old:bpy.data.objects.remove(old,do_unlink=True)
 source=bpy.data.objects['Original '+kind];source.hide_render=True;source.hide_set(True)
 ob=source.copy();ob.data=source.data.copy();scene.collection.objects.link(ob);ob.name='Seated '+kind;ob.hide_render=False;ob.hide_set(False)
 arr=np.empty(len(ob.data.vertices)*3,np.float32);ob.data.vertices.foreach_get('co',arr);v=arr.reshape((-1,3));out=v.copy();x,y,z=v.T
 # Arms are separated by position only for deformation weights. No geometry is cut apart.
 if kind=='bear':
  hip=-.075;knee=-.285;elbow=-.045;arm=smooth(.115,.147,abs(x))*(1-smooth(.035,.095,z))
  # Include the hand-held bag in the same arm transform, keeping its detailed geometry.
  arm=np.maximum(arm,((x>.123)&(z<-.183)).astype(float))
  scale=1.27;contact=-.137
 else:
  hip=-.11;knee=-.30;elbow=-.063;arm=smooth(.123,.148,abs(x))*(1-smooth(.005,.09,z))*smooth(-.265,-.24,z)
  scale=1.46;contact=-.173
 # Follow an arc-length spine through the pelvis, retaining cross-section thickness.
 top=hip+.05;length=.155 if kind=='bear' else .17;angle=math.radians(78);radius=length/angle
 distance=np.maximum(0,top-z);phi=np.minimum(distance/length,1)*angle;extra=np.maximum(0,distance-length)
 lower=v.copy();cy=.025-radius*(1-np.cos(phi))-extra*math.sin(angle);cz=top-radius*np.sin(phi)-extra*math.cos(angle)
 lower[:,1]=cy+(y-.025)*np.cos(phi);lower[:,2]=cz-(y-.025)*np.sin(phi)
 above=z>=top;lower[above]=v[above]
 # The knee is only slightly flexed; it stays part of the original continuous leg.
 knee_s=top-knee;ky=.025-radius*(1-math.cos(angle))-(knee_s-length)*math.sin(angle);kz=top-radius*math.sin(angle)-(knee_s-length)*math.cos(angle)
 knee_w=1-smooth(knee-.025,knee+.025,z)
 bent=rotate_x(lower,math.radians(9)*knee_w,(0,ky,kz));lower=bent
 arm_angle=math.radians(-38)*(1-smooth(elbow-.035,elbow+.035,z))
 posed_arms=rotate_x(v,arm_angle,(0,.003,elbow));posed_arms[:,2]+=.012*(1-smooth(elbow-.02,elbow+.02,z))
 out=lower*(1-arm[:,None])+posed_arms*arm[:,None]
 # Draped front pleats follow the top of the thighs rather than rolling upwards.
 if kind=='cat':
  skirt=(1-smooth(-.098,-.076,y))*smooth(.098,.243,-z)*(1-smooth(.253,.267,-z))*(1-arm)
  out[:,1]-=.115*skirt;out[:,2]-=.075*skirt
 else:
  skirt=(1-smooth(-.135,-.10,y))*smooth(.116,.159,-z)*(1-smooth(.175,.208,-z))*(1-arm)
  out[:,1]-=.14*skirt;out[:,2]-=.062*skirt
 # Contact patch gently follows the cushion; front legs are free to extend below its level.
 back=smooth(-.18,-.045,out[:,1])*(1-smooth(hip-.03,hip+.035,z))*(1-arm)
 floor=contact+.003
 delta=np.maximum(0,floor-out[:,2])*back
 out[:,2]+=delta
 out[:,2]-=contact
 out*=scale
 ob.data.vertices.foreach_set('co',out.astype(np.float32).ravel());ob.data.update();ob['seatScale']=scale;ob['sourceContact']=contact
 # Keep original vertex normals recalculated from the continuous deformed surface.
 for f in ob.data.polygons:f.use_smooth=True
 print(kind,'posed bounds',out.min(0).tolist(),out.max(0).tolist(),'arm weights',int((arm>.9).sum()))
 # Temporary seat purely for comparison renders; it will not enter the exported character.
 for o in list(scene.objects):
  if o.name.startswith('Pose preview seat'):bpy.data.objects.remove(o,do_unlink=True)
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,.03,-.035));seat=bpy.context.object;seat.name='Pose preview seat';seat.scale=(.60,.53,.055)
 mat=bpy.data.materials.get('Pose preview walnut') or bpy.data.materials.new('Pose preview walnut');mat.diffuse_color=(.13,.075,.035,1);seat.data.materials.append(mat)
 scene.camera.data.ortho_scale=1.5
 for view,pos in [('side',(3,0,.51)),('threequarter',(1.7,-3,1.4))]:
  target=Vector((0,-.13,.35));scene.camera.location=pos;scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=root+'/output/'+kind+'-seated-'+view+'.png';bpy.ops.render.render(write_still=True)
 ob.hide_render=True
print('Continuous source-mesh seating pose previews complete')

# Export the local web derivatives and editable source.
import bpy,numpy as np,os,json
root=str(ROOT)
scene=bpy.context.scene
assert scene.name=='Visitor source pose workshop'
for kind in ['bear','cat']:
 ob=bpy.data.objects['Seated '+kind];m=ob.data
 source=appearance_data[kind];v=source['vertices'];rgb=source['rgb']
 ids=np.array([list(p.vertices) for p in m.polygons]);centers=v[ids].mean(1);rgb=rgb[ids].mean(1);x,y,z=centers.T;r,g,b=rgb.T
 category=np.zeros(len(ids),np.int32)
 if kind=='cat':
  hair=(z>.103)&((y>-.073)|(abs(x)>.107)|(z>.265))&(b>r*.98)&(g>.22)
  eye=(((abs(x)-.074)/.03)**2+((z-.203)/.028)**2<1)&(y<-.10)&(r>.20)&(r>g*1.2)&(b>g*1.12)
  top=(z>-.111)&(z<.111)&(r>.36)&(g>r*.91)&(b>r*.9)
  bottom=(z<-.092)&(z>-.256)&(abs(x)<.138)&(b>r*1.12)&(b<.46)
 else:
  hair=(z>-.025)&(z<.322)&((y>-.128)|(abs(x)>.105)|(z>.228))&(r<.35)&(r>g*1.15)
  eye=(((abs(x)-.063)/.023)**2+((z-.244)/.024)**2<1)&(y<-.10)&(r>.06)&(r<.45)&(r>g*1.1)
  top=(z>.016)&(z<.141)&(abs(x)<.151)&(g>.32)&(r<g*1.4)&(b>g*.69)
  bottom=(z<.015)&(z>-.178)&(abs(x)<.147)&(r<.48)
 for index,mask in enumerate([hair,eye,top,bottom],1):category[mask]=index
 base=m.materials[0];m.materials.clear()
 # Resize copies only; imported source textures and external GLBs remain untouched.
 copies={}
 for index,name in enumerate(['Original','TintHair','TintEyes','TintTop','TintBottom']):
  mat=base.copy();mat.name=kind+'_'+name
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image:
    original=node.image
    if original.name not in copies:
     im=original.copy();im.name=kind+' web '+original.name;im.scale(2048,2048);im.pack();copies[original.name]=im
    node.image=copies[original.name]
  m.materials.append(mat)
 m.polygons.foreach_set('material_index',category)
 print(kind,'material faces',np.bincount(category,minlength=5).tolist())
 bpy.ops.object.select_all(action='DESELECT');ob.hide_set(False);ob.hide_render=False;ob.select_set(True);bpy.context.view_layer.objects.active=ob
 mod=ob.modifiers.new('Web surface budget','DECIMATE');mod.ratio=.68;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor-'+kind+'-v3.glb',export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_image_format='JPEG',export_jpeg_quality=92)
 print(kind,'export triangles',len(ob.data.polygons),'bytes',os.path.getsize(root+'/public/models/studio-visitor-'+kind+'-v3.glb'))
 ob.hide_render=True
# Present the two editable derivatives side by side in their own local source file.
for kind,offset in [('bear',-.43),('cat',.43)]:
 ob=bpy.data.objects['Seated '+kind];ob.location.x=offset;ob.hide_render=False;ob.hide_set(False)
for ob in scene.objects:
 if ob.name.startswith('Pose preview seat'):ob.hide_render=True;ob.hide_set(True)
scene.camera.location=(1.9,-3,1.5);from mathutils import Vector
scene.camera.rotation_euler=(Vector((0,-.1,.4))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=2.1
scene.render.resolution_x=1200;scene.render.resolution_y=950;scene.render.filepath=root+'/output/visitor-pair-v3.png';bpy.ops.render.render(write_still=True)
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitors-v3.blend',compress=True)
print('Saved editable models locally')
