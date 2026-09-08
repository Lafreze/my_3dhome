import bpy,math
from mathutils import Vector
root='/Users/satori/Documents/my_3d_test';a=bpy.data.objects['StudioVisitor'];head=bpy.data.objects['Head']
assert bpy.context.scene.name=='Studio Visitor'
for o in list(head.children):
 if o.type!='MESH':continue
 name=o.data.materials[0].name
 if name=='Chestnut strand ridges':
  bpy.data.objects.remove(o,do_unlink=True);continue
 if name=='Warm porcelain skin':
  matrix=head.matrix_world.inverted()@o.matrix_world; inv=matrix.inverted()
  for v in o.data.vertices:
   p=matrix@v.co
   if p.y<-.14:
    w=math.exp(-((abs(p.x)-.17)/.07)**2-((p.z+.10)/.068)**2)
    p.y+=.032*w
    v.co=inv@p
 if name in ['Chestnut sculpted curls','Chocolate swept locks']:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Silky curl silhouette','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
# Fine strand engraving is represented with a subtle exportable tangent normal texture.
size=256;image=bpy.data.images.new('Soft hair striation',size,size);px=[]
for y in range(size):
 for x in range(size):
  n=.5+.055*math.sin((x+math.sin(y/24)*2)*math.tau/8)
  px.extend((n,.5,1,1))
image.pixels=px;image.colorspace_settings.name='Non-Color';image.pack()
# Keep the main curls clean: no floating strokes or dark outer outlines.
for o in a.children_recursive:
 if o.type!='MESH':continue
 if o.data.materials[0].name in ['Chestnut sculpted curls','Chocolate swept locks']:
  if not o.data.uv_layers:o.data.uv_layers.new(name='Hair flow')
  for face in o.data.polygons:
   for li in face.loop_indices:
    co=o.data.vertices[o.data.loops[li].vertex_index].co
    o.data.uv_layers.active.data[li].uv=(co.x*2.0,co.z*2.0)
for name in ['Chestnut sculpted curls','Chocolate swept locks']:
 m=bpy.data.materials[name];nodes=m.node_tree.nodes;links=m.node_tree.links
 t=nodes.new('ShaderNodeTexImage');t.image=image
 normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.18
 links.new(t.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
bpy.ops.object.select_all(action='DESELECT');a.select_set(True)
for o in a.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=a
bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitor.blend')
bpy.ops.render.render(write_still=True)
