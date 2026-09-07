"""Refine the fitted GLB from prepare-sculpture.py: correct fur, retain royal details."""
import bpy,os,json,math,sys
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.join(root,'public/models/gallery-figure.glb')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
fur=bpy.data.materials.new('Ivory white fur');fur.use_nodes=True
bsdf=fur.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.92,.89,.83,1);bsdf.inputs['Roughness'].default_value=.93;bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Subsurface Weight'].default_value=.045
def material(name,color,roughness,metalness=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=roughness;n.inputs['Metallic'].default_value=metalness;return m
velvet=material('Crimson velvet cape',(.40,.018,.012),.86)
gold=material('Satin gold crown and sceptre',(.69,.40,.09),.31,.75)
eye_material=material('Obsidian eyes',(.008,.012,.015),.24)
painted=0
for obj in meshes:
 bpy.context.view_layer.objects.active=obj
 obj.select_set(True)
 # Apply its authored transform so the masks are in exhibition-size world coordinates.
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 idx=len(obj.data.materials);obj.data.materials.append(fur);red=idx+1;obj.data.materials.append(velvet);metal=idx+2;obj.data.materials.append(gold);dark=idx+3;obj.data.materials.append(eye_material)
 for poly in obj.data.polygons:
  p=obj.matrix_world@poly.center;x,y,z=p
  ear=z>.735 and -.225<x<.255
  head=.458<z<.77 and ((x-.007)/.247)**2+((z-.61)/.18)**2<1.2
  crown=.750<z<.889 and y<-.181 and (x/.097)**2+((y+.25)/.12)**2<1.12
  staff=y<-.155 and (x<-.235 if z>.55 else abs(x-(-.254-.08*z))<.031)
  eye=y<-.29 and (((x+.079)/.028)**2+((z-.596)/.037)**2<1 or ((x-.126)/.028)**2+((z-.596)/.037)**2<1)
  nose=y<-.33 and abs(x-.008)<.016 and .515<z<.534
  mouth=y<-.34 and abs(x-.009)<.014 and .490<z<.515
  belly=y<-.055 and abs(x)<.240 and z<.405
  arm=y<-.13 and ((.19<x<.344 and .215<z<.405) or (-.275<x<-.187 and .333<z<.44))
  hand=x<-.317 and -.29<y<-.105 and .35<z<.454
  tail=y>.275 and ((x-.08)/.13)**2+((z-.13)/.13)**2<1.08
  whisker=y<-.32 and -.24<x<.29 and .435<z<.56
  white=ear or head or belly or arm or hand or tail or whisker
  poly.material_index=idx if white else red
  if crown or staff and not hand:poly.material_index=metal
  if eye:poly.material_index=dark
  # Use the existing eye surface, never a second eyeball sitting outside the face.
  if poly.material_index==idx:painted+=1
 # Weld UV seams before softly blending painted boundaries on the mesh.
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00012);bpy.ops.object.mode_set(mode='OBJECT')
 from collections import Counter
 votes=[Counter() for _ in obj.data.vertices]
 for face in obj.data.polygons:
  for v in face.vertices:votes[v][face.material_index]+=1
 colors=[Vector((.92,.89,.83)) if c.most_common(1)[0][0]==idx else Vector((.69,.40,.09)) if c.most_common(1)[0][0]==metal else Vector((.008,.012,.015)) if c.most_common(1)[0][0]==dark else Vector((.40,.018,.012)) for c in votes]
 neighbors=[set() for _ in colors]
 for edge in obj.data.edges:
  a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 for _ in range(2):
  colors=[c*.5+sum((colors[n] for n in neighbors[i]),Vector())*(.5/len(neighbors[i])) if neighbors[i] else c for i,c in enumerate(colors)]
 attr=obj.data.color_attributes.new(name='Royal finish',type='FLOAT_COLOR',domain='POINT')
 for item,color in zip(attr.data,colors):item.color=(*color,1)
 for m in [fur,velvet,gold,eye_material]:
  color=m.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Royal finish';m.node_tree.links.new(color.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 # Keep silhouette detail, reduce remaining dense geometry for multi-room navigation.
 mod=obj.modifiers.new('Final web topology','DECIMATE');mod.ratio=.80;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 for poly in obj.data.polygons:poly.use_smooth=True
 obj.select_set(False)
# Rebuild small facial details on the existing fur surface; no black outline mask.
from mathutils.bvhtree import BVHTree
body=meshes[0];deps=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(body,deps)
def front(x,z):
 origin=body.matrix_world.inverted()@Vector((x,-2,z));direction=body.matrix_world.inverted().to_3x3()@Vector((0,1,0));hit=tree.ray_cast(origin,direction)[0]
 return (body.matrix_world@hit).y if hit else -.35
def oval(name,position,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=1,location=position);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 for face in o.data.polygons:face.use_smooth=True
 meshes.append(o);o.select_set(False)
for x in [-.079,.126]:
 y=front(x-.004,.608)-.0015
 oval('Inset eye glint',(x-.004,y,.608),(.0035,.0018,.0035),material('Eye glint '+str(x),(.95,.95,.92),.3))
eye_material=material('Soft charcoal facial details',(.008,.012,.015),.36)
noseY=front(.008,.523)-.006
oval('Soft nose',(.008,noseY,.523),(.014,.008,.009),eye_material)
curve=bpy.data.curves.new('Gentle mouth','CURVE');curve.dimensions='3D';curve.bevel_depth=.0012;curve.bevel_resolution=3
for path in [[(.008,.516),(.008,.503),(-.002,.494),(-.018,.495)],[(.008,.503),(.020,.494),(.035,.495)]]:
 sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(path)-1)
 for p,(x,z) in zip(sp.bezier_points,path):p.co=(x,front(x,z)-.002,z);p.handle_left_type=p.handle_right_type='AUTO'
mouth=bpy.data.objects.new('Mouth',curve);bpy.context.collection.objects.link(mouth);mouth.data.materials.append(eye_material)
bpy.context.view_layer.objects.active=mouth;mouth.select_set(True);bpy.ops.object.convert(target='MESH');meshes.append(bpy.context.object);bpy.context.object.select_set(False)
for obj in meshes:obj.select_set(True)
out=os.path.join(root,'public/models/gallery-figure.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=86,export_yup=True,export_animations=False)
reportfile=os.path.join(root,'public/models/gallery-figure.json');report=json.load(open(reportfile));report.update(faces=sum(len(o.data.polygons) for o in meshes),triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),bytes=os.path.getsize(out),textures=[],refinement='White fur with softened vertex-color boundaries, satin gold accessories, original eye topology recolored without floating overlays, and clean facial details',fur_faces=painted);json.dump(report,open(reportfile,'w'),indent=2)
# Inspect front and three-quarter views after repair.
bpy.ops.object.select_all(action='DESELECT');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.25,.29,.27,1);bpy.context.object.data.materials.append(mat)
for pos,power in [((2,-3,4),400),((-3,-1,2),250),((0,3,3),350)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.size=4;l.rotation_euler=(Vector((0,0,.5))-l.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.world.color=(.3,.3,.3);s.render.resolution_x=900;s.render.resolution_y=1000;s.render.resolution_percentage=100
for name,pos in [('front',(0,-3,.65)),('angle',(1.6,-2.7,1.4)),('back',(-1.6,2.7,1.3))]:
 bpy.ops.object.camera_add(location=pos);cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.5;s.camera=cam;s.render.filepath=os.path.join(root,'output/model/rabbit-white-'+name+'.png');bpy.ops.render.render(write_still=True)
print('REFINED',report)
