import bpy
root='/Users/satori/Documents/my_3d_test';a=bpy.data.objects['StudioVisitor']
assert bpy.context.scene.name=='Studio Visitor'
# Maintain a clear gap between all nine .637-unit banquette seats, including head sway.
a.scale.x=.84
bpy.ops.object.select_all(action='DESELECT');a.select_set(True)
for o in a.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=a
bpy.ops.export_scene.gltf(filepath=root+'/public/models/studio-visitor.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=root+'/assets/models/studio-visitor.blend')
print('Fitted width for adjacent cafe seats')
