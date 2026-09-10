"""Build seated and intact rest derivatives of the two user supplied visitors.
blender --background --factory-startup --python scripts/prepare-guest-figures.py -- noir|rose /path/source.glb
Use --prepared only for local iteration from output/visitor-pair's normalized inspection export.
Source files are never changed. No network assets are downloaded.
"""
import bpy,sys,math,json,hashlib
import numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[1];args=sys.argv[sys.argv.index('--')+1:];kind,source=args[0],Path(args[1]);prepared='--prepared' in args
if kind not in ['noir','rose'] or bpy.data.filepath:raise RuntimeError('Fresh document and known character required')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source));objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];original=sum(len(o.data.polygons) for o in objects)
for o in objects:
 bpy.context.view_layer.objects.active=o
 if not prepared:
  dec=o.modifiers.new('Web silhouette','DECIMATE');dec.ratio=min(1,48000/original);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
 o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=kind+'_continuous_body';m=ob.data
v=np.array([p.co[:] for p in m.vertices]);lo=v.min(0);hi=v.max(0)
if not prepared:v=(v-np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]]))*1.3/(hi[2]-lo[2])
for im in bpy.data.images:
 if max(im.size)>1024:im.scale(1024,1024)
# Face-level regions share original UV artwork; recoloring is opt-in in the existing shader.
faces=np.array([list(p.vertices) for p in m.polygons]);centers=v[faces].mean(1);x,y,z=centers.T
base=m.materials[0];bsdf=next(n for n in base.node_tree.nodes if n.type=='BSDF_PRINCIPLED');im=bsdf.inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4)
uv=np.array([p.uv[:] for p in m.uv_layers.active.data]);samples=pixels[np.clip((uv[:,1]*im.size[1]).astype(int),0,im.size[1]-1),np.clip((uv[:,0]*im.size[0]).astype(int),0,im.size[0]-1),:3];rgb=samples.reshape(-1,3,3).mean(1);r,g,b=rgb.T
hair=(z>.81)&((z>1.02)|(y>-.09)|(abs(x)>.155))
if kind=='rose':hair&=(r>.22)&(b>g*.96)
eye=(((abs(x)-.075)/.045)**2+((z-.95)/.035)**2<1)&(y<-.12)&(r<.7)
top=(z>.51)&(z<.82)&(np.maximum.reduce([r,g,b])<.48)
bottom=(z>.15)&(z<(.52 if kind=='noir' else .64))&(abs(x)<.19)&(np.maximum.reduce([r,g,b])<.5)
category=np.zeros(len(faces),np.int32)
for i,mask in enumerate([hair,eye,top,bottom],1):category[mask]=i
m.materials.clear()
for name in ['Original','TintHair','TintEyes','TintTop','TintBottom']:
 material=base.copy();material.name=kind+'_'+name;m.materials.append(material)
m.polygons.foreach_set('material_index',category)

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def rotate_x(p,angle,pivot):
 out=p.copy();yy=p[:,1]-pivot[1];zz=p[:,2]-pivot[2];c=np.cos(angle);s=np.sin(angle);out[:,1]=pivot[1]+c*yy-s*zz;out[:,2]=pivot[2]+s*yy+c*zz;return out
# Integrate two smooth bends along leg length, preserving section thickness at hip and knee.
top=.60 if kind=='noir' else .65;hipLength=.17;kneeStart=top-(.30 if kind=='noir' else .33);kneeLength=.12
s=np.maximum(0,top-v[:,2]);grid=np.linspace(0,top+.02,4097);angle=np.radians(78)*smooth(0,hipLength,grid)-np.radians(73)*smooth(kneeStart,kneeStart+kneeLength,grid)
ds=grid[1]-grid[0];cy=-np.cumsum(np.sin(angle))*ds;cz=top-np.cumsum(np.cos(angle))*ds;phi=np.interp(s,grid,angle);posed=v.copy();posed[:,1]=np.interp(s,grid,cy)+v[:,1]*np.cos(phi);posed[:,2]=np.interp(s,grid,cz)-v[:,1]*np.sin(phi);posed[v[:,2]>=top]=v[v[:,2]>=top]
# Bring hanging forearms forward above the lap, without separating sleeves or hands.
arm=smooth(.14,.21,abs(v[:,0]))*(1-smooth(.78,.84,v[:,2]))*smooth(.30,.40,v[:,2]);elbow=.53 if kind=='noir' else .55
arms=rotate_x(v,-math.radians(62)*(1-smooth(elbow-.035,elbow+.075,v[:,2])),(0,0,elbow));posed=posed*(1-arm[:,None])+arms*arm[:,None]
# Keep short skirts draped over the upper thighs with the original surface intact.
if kind=='rose':
 skirt=(1-smooth(-.12,-.065,v[:,1]))*smooth(.42,.47,v[:,2])*(1-smooth(.61,.66,v[:,2]))*(1-arm)
 posed[:,1]-=.06*skirt;posed[:,2]-=.035*skirt
rear=(abs(v[:,0])<.15)&(v[:,2]>(.43 if kind=='noir' else .48))&(v[:,2]<top)&(posed[:,1]>-.06)
contact=float(np.percentile(posed[rear,2],1))-.006
# Flatten only a thin continuous rear contact band; feet remain untouched.
rearWeight=smooth(-.10,-.035,posed[:,1])*(1-smooth(top-.015,top+.01,v[:,2]))*smooth(.34,.42,v[:,2])*(1-arm)
posed[:,2]+=np.maximum(0,contact+.006-posed[:,2])*rearWeight
posed[:,2]-=contact;standing=v.copy();standing[:,2]-=contact
fit=min(1.,.58/float(np.ptp(v[:,0])));posed*=fit;standing*=fit
out=root/'public/models';report=json.loads((source.parent/'source.json').read_text()) if prepared else {'source':source.name,'sourceBytes':source.stat().st_size,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceTriangles':original};report.update({'character':kind,'triangles':len(m.polygons),'height':1.3*fit,'contact':contact,'fitScale':fit,'forward':'+Z','textures':'1024px original PBR','sourceBones':0,'sourceAnimations':[],'materialFaces':np.bincount(category,minlength=5).tolist()})
for pose,vertices,suffix in [('sit',posed,'v3'),('rest',standing,'standing-v5')]:
 m.vertices.foreach_set('co',vertices.astype(np.float32).ravel());m.update()
 for p in m.polygons:p.use_smooth=True
 target=out/f'studio-visitor-{kind}-{suffix}.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=88,export_animations=False)
 report[pose]={'bytes':target.stat().st_size,'bounds':[(vertices[:,[0,2,1]]*np.array([1,1,-1])).min(0).tolist(),(vertices[:,[0,2,1]]*np.array([1,1,-1])).max(0).tolist()]}
# The original full standing figure reclines as a rigid body; never reverse-deform the sitting mesh.
upright=np.stack([standing[:,0],standing[:,2],-standing[:,1]],1);pitch=.14;angle=-math.pi/2+pitch;c=math.cos(angle);sn=math.sin(angle);rest=np.stack([upright[:,0],c*upright[:,1]-sn*upright[:,2],sn*upright[:,1]+c*upright[:,2]],1);lift=-float(rest[:,1].min())+.014;rest[:,1]+=lift
report['restPose']={'scale':1,'pitch':pitch,'lift':round(lift,7),'lengthOffset':0,'labelHeight':round(float(rest[:,1].max())+.14,2)};report['restBounds']=[rest.min(0).tolist(),rest.max(0).tolist()]
report['motionRig']={'neck':round((.815-contact)*fit,5),'neckZ':.025*fit,'headStart':round((.785-contact)*fit,5),'headEnd':round((.845-contact)*fit,5)}
(out/f'visitor-{kind}.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
# Save both independent derivatives for inspection in a local workshop only.
m.vertices.foreach_set('co',posed.astype(np.float32).ravel());m.update();ob.name=kind+'_sit'
restOb=ob.copy();restOb.data=m.copy();restOb.data.vertices.foreach_set('co',standing.astype(np.float32).ravel());restOb.data.update();bpy.context.collection.objects.link(restOb);restOb.name=kind+'_rest';restOb.rotation_mode='XYZ';restOb.rotation_euler.x=angle;restOb.location=(1.5,0,lift)
work=root/'output/visitor-pair'/kind;work.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(work/'posed.blend'))
