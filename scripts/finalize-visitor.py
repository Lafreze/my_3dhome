import bpy
root='/Users/satori/Documents/my_3d_test'
a=bpy.data.objects['StudioVisitor']
for o in a.children_recursive:
 if o.type!='MESH':continue
 name=o.data.materials[0].name
 if name not in ['Chestnut strand ridges','Warm porcelain skin']:continue
 if name=='Warm porcelain skin' and o.parent.name!='Head':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Final real time surface budget','DECIMATE');mod.ratio=.10 if name=='Chestnut strand ridges' else .48
 bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='DESELECT');a.select_set(True)
for o in a.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=a
bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitor.blend')
print('Final visitor',sum(len(o.data.polygons) for o in a.children_recursive if o.type=='MESH'))
