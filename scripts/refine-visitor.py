import bpy, math
from mathutils import Vector
root='/Users/satori/Documents/my_3d_test'
# The active document is the dedicated character file created in the previous MCP step.
assert bpy.context.scene.name == 'Studio Visitor'
head=bpy.data.objects['Head']
for ob in list(head.children):
 if ob.type!='MESH':continue
 name=ob.data.materials[0].name
 if name=='Warm porcelain skin':
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  mod=ob.modifiers.new('Continuous sculpted facial surface','REMESH');mod.mode='VOXEL';mod.voxel_size=.006;mod.use_smooth_shade=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=ob.modifiers.new('Gentle face relaxation','SMOOTH');mod.factor=.6;mod.iterations=7;bpy.ops.object.modifier_apply(modifier=mod.name)
for mat in bpy.data.materials:
 if 'Chestnut' in mat.name or 'Chocolate' in mat.name:
  mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.63
# Remove floating pocket piping; retain the fitted trouser seams and cuff stitching.
body=bpy.data.objects['Body']
for ob in list(body.children):
 if ob.type=='MESH' and ob.data.materials[0].name=='Sage stitching':
  bpy.data.objects.remove(ob,do_unlink=True)
# Web mesh budget: curved silhouettes remain smooth; instances share this single asset.
avatar=bpy.data.objects['StudioVisitor']
for ob in avatar.children_recursive:
 if ob.type!='MESH' or len(ob.data.polygons)<900:continue
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 mod=ob.modifiers.new('Web topology reduction','DECIMATE');mod.ratio=.30 if 'strand' not in ob.data.materials[0].name else .48
 bpy.ops.object.modifier_apply(modifier=mod.name)
 for face in ob.data.polygons:face.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');avatar.select_set(True)
for ob in avatar.children_recursive:ob.select_set(True)
bpy.context.view_layer.objects.active=avatar
bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitor.blend')
print('Web polygons',sum(len(o.data.polygons) for o in avatar.children_recursive if o.type=='MESH'))
bpy.ops.render.render(write_still=True)
