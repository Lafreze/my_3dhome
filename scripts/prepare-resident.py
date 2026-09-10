"""Build a web derivative of the user-supplied resident. Original file stays untouched.
blender --background --factory-startup --python scripts/prepare-resident.py -- /path/source.glb
"""
import bpy, sys, json, hashlib, math
from pathlib import Path
from mathutils import Matrix, Vector
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[sys.argv.index('--')+1])
if bpy.data.filepath: raise RuntimeError('Use a fresh --factory-startup document')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
original=sum(len(o.data.polygons) for o in meshes)
for o in meshes:
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Web silhouette reduction','DECIMATE');mod.ratio=min(1,50000/original);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 for p in o.data.polygons:p.use_smooth=True
points=[v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
scale=1.65/(hi.z-lo.z)
# Source faces Blender -Y (=glTF +Z). The life controller faces glTF -Z.
transform=Matrix.Scale(scale,4) @ Matrix.Rotation(math.pi,4,'Z') @ Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
for o in meshes:o.data.transform(transform)
for image in bpy.data.images:
 if max(image.size)>1024:
  ratio=1024/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
out=root/'public/models/resident-hi3d.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=88,export_yup=True,export_animations=False)
report={'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceBytes':source.stat().st_size,'sourceTriangles':original,'triangles':sum(len(o.data.polygons) for o in meshes),'bytes':out.stat().st_size,'height':1.65,'forward':'-Z','sourceBones':0,'sourceAnimations':[],'runtimeBones':11,'runtimeScale':1.3/1.65,'runtimeHeight':1.3,'textures':'1024px, original PBR colors','gestures':'Q-proportioned runtime legs, spine, shoulders and neutral head; hands-in-pockets silhouette retained. Quiet gaze, listening, thinking and stretch poses.'}
(root/'public/models/resident-hi3d.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
