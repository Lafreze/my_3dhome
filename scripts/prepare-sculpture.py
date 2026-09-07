"""Blender: optimize the user-supplied GLB without modifying the source file.
Usage: blender -b --factory-startup --python scripts/prepare-sculpture.py -- source.glb
"""
import bpy, sys, os, json, math
from mathutils import Vector
source = sys.argv[sys.argv.index('--') + 1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
original = sum(len(o.data.polygons) for o in meshes)
for obj in meshes:
 bpy.context.view_layer.objects.active = obj
 obj.select_set(True)
 mod = obj.modifiers.new('Web detail reduction', 'DECIMATE')
 mod.ratio = min(1, 140000 / original)
 mod.use_collapse_triangulate = True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in obj.data.polygons: p.use_smooth = True
 obj.select_set(False)
# Keep its authored orientation. glTF Y-up is converted to Blender Z-up on import.
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
lo = Vector([min(v[i] for v in points) for i in range(3)])
hi = Vector([max(v[i] for v in points) for i in range(3)])
size = hi - lo
scale = min(.84 / max(size.x, size.y), 1.16 / size.z)
center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
for obj in meshes:
 world = obj.matrix_world.copy()
 obj.parent = None
 obj.matrix_world = world
 obj.location -= center
 obj.location *= scale
 obj.scale *= scale
 obj.select_set(True)
# The source assigns full metalness to the entire painted figurine. Preserve its
# color texture while giving the painted body a satin resin finish.
for material in bpy.data.materials:
 if not material.use_nodes: continue
 for node in list(material.node_tree.nodes):
  if node.type != 'BSDF_PRINCIPLED': continue
  for name, operation, value in [('Metallic','MULTIPLY',.12),('Roughness','MAXIMUM',.44)]:
   socket = node.inputs[name]
   if socket.is_linked:
    link = socket.links[0]; origin = link.from_socket
    material.node_tree.links.remove(link)
    math_node = material.node_tree.nodes.new('ShaderNodeMath');math_node.operation=operation;math_node.inputs[1].default_value=value
    material.node_tree.links.new(origin,math_node.inputs[0]);material.node_tree.links.new(math_node.outputs[0],socket)
   else: socket.default_value = value
for img in bpy.data.images:
 if img.size[0] > 2048 or img.size[1] > 2048:
  ratio = 2048 / max(img.size)
  img.scale(round(img.size[0]*ratio), round(img.size[1]*ratio))
out = os.path.join(root,'public/models/gallery-figure.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88, export_yup=True, export_animations=False)
report = {'source':os.path.basename(source), 'source_faces': original, 'faces': sum(len(o.data.polygons) for o in meshes), 'width':size.x*scale,'depth':size.y*scale,'height':size.z*scale,'bytes':os.path.getsize(out),'textures':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images]}
with open(os.path.join(root,'public/models/gallery-figure.json'),'w') as f: json.dump(report,f,indent=2)
print('MODEL_REPORT',json.dumps(report),flush=True)
# Render the processed asset for visual inspection.
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.004))
mat=bpy.data.materials.new('Preview floor');mat.diffuse_color=(.26,.3,.28,1);bpy.context.object.data.materials.append(mat)
for pos,power,size in [((2,-3,4),500,4),((-3,-1,2),350,3),((0,3,3),450,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,.5))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(1.55,-2.4,1.5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.65
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.3,.3,.3);scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(root,'output/model/sculpture-preview.png');bpy.ops.render.render(write_still=True)
