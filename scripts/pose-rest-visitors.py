"""Author a continuous supine rest shape in Blender, preserving the approved seated Basis.
Run: Blender --background --factory-startup --python scripts/pose-rest-visitors.py
Source v3 GLBs stay untouched. The web uses a per-person Rest shape and live closed eyelids.
"""
from pathlib import Path
import bpy, math, numpy as np
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
if bpy.data.filepath: raise RuntimeError('Use a fresh Blender document')
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from mathutils import Vector

def rotate_x(v,angle,pivot):
 out=v.copy();y=v[:,1]-pivot[1];z=v[:,2]-pivot[2];c=np.cos(angle);ss=np.sin(angle);out[:,1]=c*y-ss*z+pivot[1];out[:,2]=ss*y+c*z+pivot[2];return out
rx=rotate_x

def reference_pose(v,kind):
 x,y,z=v.T;out=v.copy()
 if kind!='fox':
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
 else:
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
 return out

for kind in ['bear','cat','fox']:
 library=ROOT/'assets/models'/('studio-visitor-fox-v3.blend' if kind=='fox' else 'studio-visitors-v3.blend')
 with bpy.data.libraries.load(str(library),link=False) as (src,dst):dst.objects=['Original '+kind]
 original=dst.objects[0];mesh=original.data
 original_positions=np.array([v.co[:] for v in mesh.vertices]);posed=reference_pose(original_positions,kind)
 faces=[tuple(p.vertices) for p in mesh.polygons]
 tree=BVHTree.FromPolygons([Vector(p) for p in posed],faces,all_triangles=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'studio-visitor-{kind}-v3.glb'))
 imported=[o for o in bpy.context.selected_objects if o.type=='MESH']
 for ob in imported:
  ob.data.transform(ob.matrix_world);ob.parent=None;ob.matrix_world=Matrix.Identity(4)
  raw=np.empty(len(ob.data.vertices)*3,np.float32);ob.data.vertices.foreach_get('co',raw)
  b=raw.reshape(-1,3);v=np.stack([b[:,0],b[:,2],-b[:,1]],1);x,y,z=v.T
  # Transfer each web vertex back through the original high-resolution sitting surface.
  # This keeps the approved Basis topology/UVs and restores the intact standing limbs.
  mapped=[];errors=[]
  scale={'bear':1.27,'cat':1.46,'fox':1.15}[kind];contact={'bear':-.137,'cat':-.173,'fox':-.236}[kind]
  for point in b:
   nearest,normal,index,distance=tree.find_nearest(Vector(point))
   a0,a1,a2=faces[index]
   p=barycentric_transform(nearest,Vector(posed[a0]),Vector(posed[a1]),Vector(posed[a2]),Vector(original_positions[a0]),Vector(original_positions[a1]),Vector(original_positions[a2]))
   mapped.append(p);errors.append(distance)
  original_v=np.array(mapped)
  upright=np.stack([original_v[:,0]*scale,(original_v[:,2]-contact)*scale,-original_v[:,1]*scale],1)
  # Preserve the exact original head alignment for the live eyelids.
  head=smooth({'bear':.27,'cat':.245,'fox':.19}[kind],{'bear':.35,'cat':.355,'fox':.30}[kind],y)
  upright=upright*(1-head[:,None])+v*head[:,None]
  rest=np.stack([upright[:,0],upright[:,2],-upright[:,1]],1)
  lift=.27 if kind=='cat' else .23
  rest[:,1]+=lift+.065*head-.09*(1-head)
  if kind=='fox':
   ox,oy,oz=original_v.T
   tail=np.maximum(smooth(.075,.135,oy),smooth(.16,.235,abs(ox))*smooth(-.035,.025,oy))
   tail=np.maximum(tail,smooth(-.05,-.015,oy)*(1-smooth(-.20,-.13,oz)))
   tail*=1-smooth(.315,.37,oz)
   # Use the original tail membership, including the roots; a depth-only mask
   # stretched the transition into ribbons between the body and the tail fan.
   folded=np.stack([x*1.2,-z-.072,y+.08],1)
   rest=rest*(1-tail[:,None])+folded*tail[:,None]
   # Settle the broad tail roots onto the mattress instead of leaving upright
   # membranes where the compact sitting fan meets the unfolded body.
   settle=(1-smooth(-.055,.02,z))*smooth(-.12,.04,rest[:,2])
   resting_floor=.06+np.clip(-z,0,.2)*.16
   rest[:,1]+=(np.minimum(rest[:,1],resting_floor)-rest[:,1])*settle
  rest[:,1]=np.maximum(rest[:,1],.018)
  print(kind,'source mapping max error',max(errors))
  ob.shape_key_add(name='Basis')
  shape=ob.shape_key_add(name='Rest')
  target=np.stack([rest[:,0],-rest[:,2],rest[:,1]],1)
  shape.data.foreach_set('co',target.astype(np.float32).ravel())
  ob.name=f'{kind} seated and resting'
  ob['restPose']='Supine, legs unfolded, head towards pillow; Basis remains the approved sitting pose.'
  ob['character']=kind
  print(kind,'rest bounds',rest.min(0).tolist(),rest.max(0).tolist())
 bpy.ops.object.select_all(action='DESELECT')
 for ob in imported:ob.select_set(True)
 bpy.context.view_layer.objects.active=imported[0]
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'studio-visitor-{kind}-v4.glb'),export_format='GLB',use_selection=True,export_yup=True,export_morph=True,export_morph_normal=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
 for ob in imported:ob.hide_render=True;ob.hide_set(True)
# Reference meshes are inputs in the v3 projects; do not duplicate them in v4.
for obj in list(bpy.data.objects):
 if obj.name.startswith('Original '): bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/models/studio-visitors-rest-v4.blend'),compress=True)
print('Rest shapes saved; source v3 models preserved.')
