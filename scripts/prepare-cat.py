"""Create a small, reproducible web derivative; leave the supplied GLB untouched.
blender --background --factory-startup --python scripts/prepare-cat.py -- /path/source.glb
"""
import bpy, sys, json, math, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
original=sum(len(o.data.polygons) for o in meshes)
for o in meshes:
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Web silhouette reduction','DECIMATE');mod.ratio=min(1,28000/original);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 for p in o.data.polygons:p.use_smooth=True
points=[v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
scale=.9/(hi.z-lo.z)
transform=Matrix.Scale(scale,4) @ Matrix.Rotation(math.pi,4,'Z') @ Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
for o in meshes:o.data.transform(transform)
for image in bpy.data.images:
 if max(image.size)>1024:
  ratio=1024/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
out=root/'public/models/cat-hi3d.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=90,export_yup=True,export_animations=False)
report={'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceBytes':source.stat().st_size,'sourceTriangles':original,'triangles':sum(len(o.data.polygons) for o in meshes),'bytes':out.stat().st_size,'height':.9,'runtimeScale':.6,'runtimeHeight':.54,'forward':'-Z','runtimeBones':16,'sourceBones':0,'sourceAnimations':[],'textures':'1024px original PBR colors','animation':'Existing distance-driven four-paw gait, runtime body/head/tail and 4 two-link legs; no second cat controller.'}
(root/'public/models/cat-hi3d.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False),flush=True)
