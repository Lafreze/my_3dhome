"""Local Blender MCP authoring: preserve supplied porcelain face and boots; rebuild
seated wardrobe, four interchangeable hairstyles, bear hood and tinted materials.
The original user GLB is never modified.
"""
import bpy, math, random, os, numpy as np
from mathutils import Vector, Matrix
ROOT='/Users/satori/Documents/my_3d_test'
scene=bpy.context.scene
source=scene.objects.get('Original Bear Girl - reference copy')
if source is None:
 # Start an isolated document collection instead of modifying a user's open scene.
 scene=bpy.data.scenes.new('Bear Character Reference');bpy.context.window.scene=scene
 reference=os.environ.get('STUDIO_VISITOR_REFERENCE','/Users/satori/Downloads/Hi3D_Stylized Chibi Bear Girl 3D Character_allparts_20260908_150541.glb')
 bpy.ops.import_scene.gltf(filepath=reference)
 source=next(o for o in bpy.context.selected_objects if o.type=='MESH')
 source.name='Original Bear Girl - reference copy';source.data.transform(source.matrix_world);source.parent=None;source.matrix_world=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT');source.select_set(True);bpy.context.view_layer.objects.active=source
 mod=source.modifiers.new('Web reference topology','DECIMATE');mod.ratio=.07;bpy.ops.object.modifier_apply(modifier=mod.name)
 image=next(n.image for n in source.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and any(l.to_socket.name=='Base Color' for l in n.outputs['Color'].links))
 source['sourceTexture']=image.name
assert scene.name in ('Bear Character Reference','Studio Visitor Atelier')
scene.name='Studio Visitor Atelier'
for obj in list(scene.objects):
 if obj.get('atelier'):bpy.data.objects.remove(obj,do_unlink=True)
source.hide_render=True;source.hide_set(True)
source.data.update()
random.seed(42)
parts=[]
def empty(name,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=p;o.parent=parent;o['atelier']=True;return o
avatar=empty('StudioVisitorV2');avatar.scale.x=.91;body=empty('Body',parent=avatar);head=empty('Head',(0,0,1.0),avatar);head.scale=(1.14,1.14,1.14)
def mat(name,c,rough=.7,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;
 for n in list(m.node_tree.nodes):
  if n.type not in ('BSDF_PRINCIPLED','OUTPUT_MATERIAL'):m.node_tree.nodes.remove(n)
 m.diffuse_color=(*c,1)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 return m
skin=mat('Porcelain warm skin',(.73,.49,.36),.75)
blush=mat('Ear porcelain rose',(.65,.32,.24),.77)
top=mat('TintTop',(1,1,1),.92);bottom=mat('TintBottom',(1,1,1),.88)
hair=mat('TintHair',(1,1,1),.42);hairRidge=mat('TintHairRidge',(.8,.8,.8),.5)
hoodMat=mat('Bear hood suede',(.39,.20,.084),.87);hoodInner=mat('Bear hood warm lining',(.82,.70,.50),.94)
gold=mat('Brushed brass buttons',(.55,.35,.12),.32,.68)
thread=mat('Ivory stitching',(.78,.71,.56),.95)
black=mat('Chocolate embroidery',(.047,.027,.018),.75)
sock=mat('Ivory knitted socks',(.75,.71,.60),.95)
# Real exportable normal map. Small-knit repeats are baked into UV space.
for material,kind in [(top,'rib knit'),(bottom,'twill')]:
 size=256
 yy,xx=np.mgrid[0:size,0:size]
 if kind=='rib knit':height=.50+.18*np.sin(xx*math.tau/8)+.10*np.sin(yy*math.tau/12+np.sin(xx*math.tau/8))
 else:height=.5+.17*np.sin((xx+yy)*math.tau/7)
 base=np.ones((size,size,4),dtype=np.float32);base[:,:,:3]=(.9+.09*height)[:,:,None]
 im=bpy.data.images.new('Atelier '+kind+' albedo',size,size);im.pixels.foreach_set(base.ravel());im.pack()
 n=material.node_tree.nodes;links=material.node_tree.links
 tex=n.new('ShaderNodeTexImage');tex.image=im;links.new(tex.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
 dx=np.roll(height,-1,1)-np.roll(height,1,1);dy=np.roll(height,-1,0)-np.roll(height,1,0)
 normal=np.ones((size,size,4),dtype=np.float32);normal[:,:,0]=.5-dx*.25;normal[:,:,1]=.5-dy*.25;normal[:,:,2]=1
 ni=bpy.data.images.new('Atelier '+kind+' tangent normal',size,size);ni.colorspace_settings.name='Non-Color';ni.pixels.foreach_set(normal.ravel());ni.pack()
 nt=n.new('ShaderNodeTexImage');nt.image=ni;nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35;links.new(nt.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],n.get('Principled BSDF').inputs['Normal'])
def finish(o,name,m,parent=body):
 o.name=name;o['atelier']=True;o.parent=parent;o.data.materials.append(m);parts.append(o)
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o
def oval(name,p,s,m,parent=body,seg=24,rings=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
 o=finish(bpy.context.object,name,m,parent);o.scale=s;return o
def cube(name,p,s,m,r=.015,parent=body):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=finish(bpy.context.object,name,m,parent);o.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=o.modifiers.new('Soft tailored edges','BEVEL');mod.width=r;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name);return o
def curve(name,points,r,m,parent=body):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2 if 'strand' in name.lower() else 4;c.bevel_depth=r;c.bevel_resolution=0 if 'strand' in name.lower() else 1
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for a,p in zip(sp.bezier_points,points):a.co=p;a.handle_left_type='AUTO';a.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);return finish(o,name,m,parent)
def link(name,a,b,rx,ry,m,parent=body):
 a,b=Vector(a),Vector(b);o=oval(name,(a+b)/2,(rx,ry,(b-a).length/2+min(rx,ry)*.4),m,parent)
 o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(name,verts,faces,m,parent=body):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,m,parent)
# Reuse the reference's hand-sculpted face, with UVs and all its painted facial details.
base=source.data.materials[0].copy();base.name='Reference porcelain face'
for node in base.node_tree.nodes:
 if node.type=='TEX_IMAGE' and node.image:
  im=node.image.copy();im.name='Reference atlas 2048 '+node.image.name;im.scale(2048,2048);im.pack();node.image=im
base.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.72
# A monochrome eye atlas keeps the painted pupil, lashes and glints while allowing iris tint.
eye=base.copy();eye.name='TintEyes'
for node in eye.node_tree.nodes:
 if node.type=='TEX_IMAGE' and node.image and any(l.to_socket.name=='Base Color' for l in node.outputs['Color'].links):
  im=node.image.copy();im.name='Reference iris luminance';pix=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(pix);pix=pix.reshape((-1,4));lum=pix[:,:3].mean(1);pix[:,:3]=np.clip(lum[:,None]*2.6,0,1);im.pixels.foreach_set(pix.ravel());im.pack();node.image=im
uv=source.data.uv_layers.active.data
image=bpy.data.images[source['sourceTexture']];pixels=np.empty(len(image.pixels),np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape((image.size[1],image.size[0],4))
def colour(f):
 u=uv[f.loop_indices[0]].uv;return pixels[int((u.y%1)*(image.size[1]-1)),int((u.x%1)*(image.size[0]-1)),:3]
def extract(name,faces,transform,material,parent):
 vertices=[];polys=[];texcoords=[]
 for face in faces:
  offset=len(vertices)
  for i in face.loop_indices:
   vertices.append(transform(source.data.vertices[source.data.loops[i].vertex_index].co));texcoords.append(tuple(uv[i].uv))
  polys.append(tuple(range(offset,len(vertices))))
 o=mesh(name,vertices,polys,material,parent);layer=o.data.uv_layers.new(name='UVMap')
 for i,u in enumerate(texcoords):layer.data[i].uv=u
 # Weld coincident source vertices, retaining UV seams.
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.object.mode_set(mode='OBJECT')
 return o
if not scene.objects.get('High detail face reference'):
 previous=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=os.environ.get('STUDIO_VISITOR_REFERENCE','/Users/satori/Downloads/Hi3D_Stylized Chibi Bear Girl 3D Character_allparts_20260908_150541.glb'))
 imported=set(bpy.data.objects)-previous
 high=next(o for o in imported if o.type=='MESH')
 high.data.transform(high.matrix_world);high.parent=None;high.matrix_world=Matrix.Identity(4)
 me=high.data
 coords=np.empty(len(me.vertices)*3,np.float32);me.vertices.foreach_get('co',coords);coords=coords.reshape((-1,3))
 loops=np.empty(len(me.loops),np.int32);me.loops.foreach_get('vertex_index',loops);tris=loops.reshape((-1,3));centers=coords[tris].mean(1)
 x,y,z=centers.T;chosen=np.nonzero((z>.162)&(z<.288)&(abs(x)<.090)&(y<-.064))[0]
 indices=tris[chosen].reshape(-1);unique,inverse=np.unique(indices,return_inverse=True)
 uvs=np.empty(len(me.loops)*2,np.float32);me.uv_layers.active.data.foreach_get('uv',uvs);uvs=uvs.reshape((-1,3,2))[chosen].reshape(-1)
 result=bpy.data.meshes.new('Detailed reference face UV topology');result.from_pydata(coords[unique].tolist(),[],inverse.reshape((-1,3)).tolist());result.update()
 layer=result.uv_layers.new(name='UVMap');layer.data.foreach_set('uv',uvs)
 ob=bpy.data.objects.new('High detail face reference',result);scene.collection.objects.link(ob);result.materials.append(scene.objects['Original Bear Girl - reference copy'].data.materials[0])
 for p in result.polygons:p.use_smooth=True
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 mod=ob.modifiers.new('Preserve face detail','DECIMATE');mod.ratio=.32;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.hide_render=True;ob.hide_set(True)
 print('Source face detail',len(chosen),'faces reduced to',len(ob.data.polygons))

lowSource=source;source=scene.objects['High detail face reference'];uv=source.data.uv_layers.active.data
faceparts=[];eyeparts=[]
for f in source.data.polygons:
 x,y,z=f.center
 if .16<z<.287 and abs(x)<.103 and y<-.045:
  col=colour(f)
  if col.mean()<.12 and (z<.208 or abs(x)>.082) and not (abs(x)<.03 and .18<z<.205):continue
  if .207<z<.253 and .028<abs(x)<.075 and .09<col[0]<.48 and col[0]>col[2]*1.2:eyeparts.append(f)
  else:faceparts.append(f)
convert=lambda v:(v.x*1.85,v.y*1.85,(v.z-.23)*1.85-.04)
extract('Authored porcelain face',faceparts,convert,base,head)
extract('Painted irises',eyeparts,convert,eye,head)
source=lowSource;uv=source.data.uv_layers.active.data
# Skull closes the rear of the extracted face; hair wraps its join.
oval('Back of head',(0,.025,.02),(.192,.16,.21),skin,head,32,20)
for s in [-1,1]:
 oval('Porcelain ear',(s*.19,-.027,-.03),(.035,.025,.052),skin,head)
 oval('Inner ear',(s*.205,-.048,-.033),(.018,.007,.032),blush,head,16,12)
oval('Neck',(0,.015,.82),(.079,.068,.105),skin)
# Seated, short body with a soft blouse and bear-inspired tailored details.
oval('Seated hips',(0,.015,.13),(.214,.172,.125),bottom)
oval('Ribbed blouse',(0,.02,.50),(.214,.15,.314),top)
oval('Blouse waistband',(0,-.007,.261),(.217,.155,.044),top)
for i in range(36):
 a=i*math.tau/36;curve('Waistband rib',[(math.cos(a)*.217*scale,math.sin(a)*.156*scale,z) for z,scale in [(.235,.81),(.261,1.003),(.279,.92)]],.0015,thread)
for s in [-1,1]:
 collar=cube('Rounded Peter Pan collar',(s*.057,-.111,.780),(.115,.055,.092),top,.024);collar.rotation_euler.y=s*-.24;collar.rotation_euler.x=-.28
# Tie, little bear badge and three brass fasteners.
mesh('Woven pointed tie',[(-.027,-.151,.693),(.027,-.151,.693),(.034,-.158,.51),(0,-.17,.474),(-.034,-.158,.51)],[(0,1,2,3,4)],hoodMat)
for z in [.637,.581,.526]:oval('Tie stitch',(0,-.168,z),(.005,.004,.01),thread,seg=12,rings=8)
for z in [.44,.376,.313]:oval('Brass blouse button',(0,-.14,z),(.012,.009,.012),gold,seg=12,rings=8)
oval('Bear breast badge',(.122,-.118,.64),(.031,.012,.028),hoodMat)
for s in [-1,1]:oval('Badge bear ear',(.122+s*.022,-.119,.662),(.013,.009,.014),hoodMat,seg=12,rings=8)
oval('Badge muzzle',(.122,-.129,.634),(.017,.006,.012),thread,seg=12,rings=8)
for s in [-1,1]:oval('Badge eye',(.122+s*.01,-.132,.648),(.003,.003,.004),black,seg=8,rings=6)
# Gender is a visible wardrobe silhouette, independent of hairstyle/colour.
female=empty('Gender_female',parent=body);male=empty('Gender_male',parent=body)
for s,word in [(-1,'Left'),(1,'Right')]:
 x=s*.129
 link('Bare seated thigh',(x,.035,.115),(x,-.325,.093),.104,.106,skin)
 oval('Rounded knee',(x,-.337,.074),(.10,.108,.104),skin)
 link('Tailored short leg',(x,.02,.137),(x,-.29,.125),.116,.112,bottom,male)
 curve('Short hem',[(x-.099,-.27,.175),(x,-.313,.216),(x+.099,-.27,.175)],.004,bottom,male)
 curve('Short pocket stitch',[(s*.179,-.039,.234),(s*.19,-.131,.229),(s*.156,-.194,.239)],.002,thread,male)
 # Lower leg and sock share the original seat-height fit rig.
 calf=empty('Calf'+word,(x,-.337,.08),avatar)
 link('Porcelain shin',(0,0,-.018),(0,.0,-.56),.070,.071,skin,calf)
 zs=[-.22,-.228,-.24,-.263,-.282,-.303,-.33,-.57,-.60];rs=[.070,.077,.077,.076,.076,.075,.074,.070,.066]
 sv=[(math.cos(a)*r,math.sin(a)*r,z) for z,r in zip(zs,rs) for a in [j*math.tau/32 for j in range(32)]]
 sf=[]
 for row in range(len(zs)-1):
  for j in range(32):sf.append((row*32+j,row*32+(j+1)%32,(row+1)*32+(j+1)%32,(row+1)*32+j))
 sockMesh=mesh('Fitted striped sock',sv,sf,sock,calf);sockMesh.data.materials.append(hoodMat)
 for face in sockMesh.data.polygons:
  if face.index//32 in [2,4]:face.material_index=1
 foot=empty('Foot'+word,(x,-.351,-.63),avatar)
 fs=[f for f in source.data.polygons if f.center.z<-.36 and (f.center.x*s)>0]
 coords=np.array([source.data.vertices[v].co[:] for f in fs for v in f.vertices]);mn=coords.min(0);mx=coords.max(0)
 # Keep the original detailed boot bow, stitches and layered sole.
 def boot(v):return ((v.x-(mn[0]+mx[0])/2)/(mx[0]-mn[0])*.188,(v.y-(mn[1]+mx[1])/2)/(mx[1]-mn[1])*.29-.04,(v.z-mn[2])/(mx[2]-mn[2])*.235-.08)
 extract('Reference bow boot '+word,fs,boot,base,foot)
 curve('Soft boot cuff piping',[(math.cos(a)*.085,math.sin(a)*.119-.04,.139) for a in [j*math.tau/24 for j in range(25)]],.012,hoodMat,foot)
 # Relaxed elbows, bear cuffs and individual fingers rest on the knees.
 link('Rounded upper sleeve',(s*.177,.017,.669),(s*.247,-.10,.452),.078,.073,top)
 link('Folded forearm sleeve',(s*.247,-.10,.452),(s*.177,-.282,.31),.072,.067,top)
 cuff=link('Bear suede cuff',(s*.193,-.253,.344),(s*.171,-.294,.31),.079,.07,hoodMat)
 cuffrot=cuff.rotation_euler.to_matrix()
 curve('Cuff inset stitching',[Vector(cuff.location)+cuffrot@Vector((math.cos(a)*.079,math.sin(a)*.070,0)) for a in [j*math.tau/24 for j in range(25)]],.0014,thread)
 oval('Resting hand',(s*.152,-.326,.27),(.062,.040,.062),skin)
 for f in range(4):
  xx=s*.151+(f-1.5)*.027
  link('Relaxed finger',(xx,-.350,.274),(xx,-.385,.212+abs(f-1.5)*.009),.012,.012,skin)
  oval('Porcelain fingernail',(xx,-.397,.23+abs(f-1.5)*.009),(.007,.0018,.009),blush,seg=12,rings=8)
 link('Thumb',(s*.204,-.322,.282),(s*.212,-.366,.242),.018,.016,skin)
# Pleated skirt is shaped over bent thighs, with drape down the front, not a standing cone.
verts=[];faces=[];N=60
for row in range(5):
 for j in range(N):
  a=j*math.tau/N;pleat=1+.055*math.cos(a*15);t=row/4
  xx=math.cos(a)*(.205+.028*t)*pleat
  yy=math.sin(a)*(.163+.107*t)-.075*t
  zz=.261-.13*t-(.088*t if math.sin(a)<0 else .045*t)
  verts.append((xx,yy,zz))
for row in range(4):
 for j in range(N):faces.append((row*N+j,row*N+(j+1)%N,(row+1)*N+(j+1)%N,(row+1)*N+j))
skirt=mesh('Seated fifteen pleat skirt',verts,faces,bottom,female)
mod=skirt.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=.006;bpy.context.view_layer.objects.active=skirt;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
 pocket=cube('Skirt stitched pocket',(s*.168,-.173,.208),(.061,.015,.069),bottom,.009,female);pocket.rotation_euler.y=s*.18
 oval('Pocket stud',(s*.168,-.183,.23),(.007,.003,.007),gold,female,12,8)
curve('Skirt brass chain',[(.13,-.192,.226),(.19,-.204,.16),(.224,-.13,.209)],.003,gold,female)
# Modular hair: smooth, tapered sculpted locks with fine strand ridges.
def lock(name,points,width,parent,depth=.60):
 pts=[Vector(p) for p in points]
 if name.startswith('Layered fringe'):
  for p in pts:
   w=max(0,min(1,(p.z-.08)/.17));p.x*=1-.06*w;p.y+=.04*w;p.z-=.016*w
 vs=[];fs=[];radial=8
 for i,p in enumerate(pts):
  tangent=(pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]).normalized();side=tangent.cross(Vector((0,1,0)))
  if side.length<.001:side=tangent.cross(Vector((1,0,0)))
  side.normalize();up=tangent.cross(side).normalized();r=width*(.22+.78*math.sin(math.pi*(i+.4)/(len(pts)-.3))**.45)
  if i==len(pts)-1:r=.0018
  for j in range(radial):
   a=j*math.tau/radial;vs.append(p+side*math.cos(a)*r+up*math.sin(a)*r*depth)
 for i in range(len(pts)-1):
  for j in range(radial):fs.append((i*radial+j,i*radial+(j+1)%radial,(i+1)*radial+(j+1)%radial,(i+1)*radial+j))
 fs.extend([tuple(reversed(range(radial))),tuple((len(pts)-1)*radial+j for j in range(radial))]);mesh(name,vs,fs,hair,parent)
 for off in [0]:
  strand=[]
  for p in pts[1:-1]:
   normal=Vector((p.x,p.y, max(.015,p.z)*.6)).normalized();strand.append(p+normal*width*.58+Vector((off*width,0,0)))
  curve('Fine carved hair strand',strand,.0011,hairRidge,parent)
styles={key:empty('Hair_'+key,parent=head) for key in ['braids','bob','crop','waves']}
for key,parent in styles.items():
 vs=[];fs=[]
 for i in range(14):
  for j in range(48):
   a=j*math.tau/48;front=max(0,-math.sin(a));edge=1.8-.69*front;th=.001+i/13*edge
   vs.append((.207*math.sin(th)*math.cos(a),.186*math.sin(th)*math.sin(a)+.018,.245*math.cos(th)+.038))
 for i in range(13):
  for j in range(48):fs.append((i*48+j,i*48+(j+1)%48,(i+1)*48+(j+1)%48,(i+1)*48+j))
 mesh('Fitted scalp '+key,vs,fs,hair,parent)
 # Front fringe covers the extracted face seam while preserving eyebrows.
 for j in range(1,8):
  x=-.175+j*.04375;pts=[]
  for k in range(13):
   t=k/12
   if key in ['braids','bob']:
    pts.append((x+.010*math.sin(t*math.pi),-.075-.155*math.sin(t*math.pi/2)+abs(x)*.25,.252-.176*t+.012*math.sin(j)))
   else:
    pts.append((x+.055*math.sin(t*math.pi),-.074-.163*math.sin(t*math.pi/2)+abs(x)*.24,.26+.034*math.sin(t*math.pi)-(.176+(.034 if j<4 else 0))*t))
  lock('Layered fringe '+key,pts,.028,parent)
 # Crown and rear follow the skull without a helmet-like uninterrupted surface.
 for j in range(17):
  a=j*math.tau/17;pts=[]
  for k in range(12):
   t=k/11;th=.18+t*(1.30 if math.sin(a)<-.5 else 1.72);ang=a+.22*math.sin(t*math.pi)
   pts.append((.216*math.sin(th)*math.cos(ang),.199*math.sin(th)*math.sin(ang)+.018,.258*math.cos(th)+.038))
  lock('Crown lock '+key,pts,.03,parent)
 if key=='braids':
  for s in [-1,1]:
   for j in range(9):
    t=j/8;xx=s*(.196+.025*math.sin(t*math.pi));zz=.047-.35*t;yy=.00-.033*t
    ob=oval('Interlaced braid',(xx+s*.018*math.sin(j*math.pi/2),yy+.015*math.cos(j*math.pi/2),zz),(.036,.041,.047),hair,parent,16,12);ob.rotation_euler.y=s*(.4 if j%2 else -.4)
    curve('Braid carved strands',[(xx-.019,yy-.030,zz+.026),(xx,yy-.044,zz),(xx+.015,yy-.029,zz-.026)],.0014,hairRidge,parent)
   for sign in [-1,1]:
    ob=oval('Braid linen bow',(s*.2+sign*.027,-.046,-.306),(.034,.013,.024),top,parent,16,10);ob.rotation_euler.y=sign*.3
   oval('Bow knot',(s*.20,-.061,-.306),(.011,.009,.014),top,parent,12,8)
 elif key in ['bob','waves']:
  for j in range(21):
   a=-.43+j*(math.pi+ .86)/20;pts=[]
   for k in range(14):
    t=k/13;radius=.194+.022*math.sin(t*math.pi)+(0.013*math.sin(t*math.tau*1.8+j) if key=='waves' else 0)
    pts.append((radius*math.cos(a),radius*.94*math.sin(a)+.02,.17-t*(.39 if key=='waves' else .30)))
   lock('Soft side length '+key,pts,.032,parent)
 else:
  for s in [-1,1]:
   for j in range(3):lock('Short sideburn',[(s*(.186+.012*math.sin(k*math.pi/10)),-.055+j*.026,.10-k*.018) for k in range(11)],.018,parent)
# Optional bear hood: an open shell, double-lined ears and embroidered muzzle.
hood=empty('Hat_bear',parent=head);vs=[];fs=[]
# Angle around vertical, with front opening stopping above the fringe.
for i in range(15):
 for j in range(64):
  a=j*math.tau/64;front=max(0,-math.sin(a));edge=1.96-.75*front;th=.0001+i/14*edge
  vs.append((.26*math.sin(th)*math.cos(a),.29*math.sin(th)*math.sin(a)+.027,.29*math.cos(th)+.074))
for i in range(14):
 for j in range(64):fs.append((i*64+j,i*64+(j+1)%64,(i+1)*64+(j+1)%64,(i+1)*64+j))
mesh('Open suede bear hood',vs,fs,hoodMat,hood)
edge=[vs[14*64+j] for j in range(64)]+[vs[14*64]];curve('Linen hood piping',edge,.008,hoodInner,hood)
for j in range(25,57):
 p=Vector(vs[14*64+j]);oval('Scalloped hood lining',p,(.014,.010,.011),hoodInner,hood,12,8)
for s in [-1,1]:
 oval('Round bear ear',(s*.188,.026,.291),(.084,.049,.089),hoodMat,hood)
 oval('Inset bear ear',(s*.188,-.017,.297),(.055,.014,.059),hoodInner,hood)
 oval('Embroidered bear eye',(s*.045,-.186,.279),(.009,.006,.012),black,hood,12,8)
patch=oval('Bear nose patch',(0,-.203,.263),(.053,.013,.036),hoodInner,hood);patch.rotation_euler.x=-.65
oval('Bear nose stitch',(0,-.206,.275),(.017,.006,.011),black,hood,12,8)
curve('Bear smile',[(0,-.218,.268),(0,-.224,.258),(.012,-.228,.253)],.0025,black,hood)
# Split the sock's woven bands, retaining colour boundaries in the shared material batches.
for ob in [o for o in list(parts) if o.type=='MESH' and len(o.data.materials)>1]:
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
# Reduce draw calls within each independently configurable node/material.
for ob in list(parts):
 if ob.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
for parent in [body,head,female,male,hood]+list(styles.values())+[o for o in avatar.children if o.name.startswith(('Calf','Foot'))]:
 mats={o.data.materials[0] for o in parent.children if o.type=='MESH'}
 for material in mats:
  children=[o for o in parent.children if o.type=='MESH' and o.data.materials[0]==material]
  bpy.ops.object.select_all(action='DESELECT')
  for o in children:o.select_set(True)
  bpy.context.view_layer.objects.active=children[0];bpy.ops.object.join();children[0].name=parent.name+' / '+material.name
# Export all variants; the app selects their visibility and tints per visitor.
bpy.ops.object.select_all(action='DESELECT');avatar.select_set(True)
for ob in avatar.children_recursive:ob.select_set(True)
bpy.context.view_layer.objects.active=avatar
os.makedirs(ROOT+'/assets/models',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/studio-visitor-v2.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=88)
# Source keeps author-friendly default colours and a studio portrait of the default variant.
for key,parent in styles.items():
 for o in parent.children_recursive:o.hide_render=key!='braids';o.hide_set(key!='braids')
for o in male.children_recursive:o.hide_render=True;o.hide_set(True)
for m,c in [(top,(.89,.82,.69)),(bottom,(.16,.20,.14)),(hair,(.070,.040,.028)),(hairRidge,(.095,.058,.037))]:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1)
# Remove previous reference-camera lights only after preserving the source.
for o in list(scene.objects):
 if o.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(o,do_unlink=True)
for name,p,power,size in [('Atelier key',(-3,-4,5),460,4),('Atelier fill',(3,-2,3),170,3),('Atelier rim',(1,2,4),330,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler();o['atelier']=True
cd=bpy.data.cameras.new('Atelier portrait');cam=bpy.data.objects.new('Atelier portrait',cd);scene.collection.objects.link(cam);cam['atelier']=True;scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=2.43
cam.location=(1.55,-4.8,1.62);cam.rotation_euler=(Vector((0,-.02,.39))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=820;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.6,.6,.6);scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/models/studio-visitor-v2.blend')
for material,c in [(top,(.89,.82,.69)),(bottom,(.16,.20,.14)),(eye,(.30,.19,.10))]:
 nodes=material.node_tree.nodes;links=material.node_tree.links;bs=nodes.get('Principled BSDF');old=bs.inputs['Base Color'].links[0]
 mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);links.new(old.from_socket,mix.inputs[1]);links.new(mix.outputs[0],bs.inputs['Base Color'])
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/models/studio-visitor-v2.blend',compress=True)
scene.render.filepath=ROOT+'/output/visitor-v2-blender.png';bpy.ops.render.render(write_still=True)
print('Exported modular visitor',sum(len(o.data.polygons) for o in avatar.children_recursive if o.type=='MESH'),'polygons',os.path.getsize(ROOT+'/public/models/studio-visitor-v2.glb'),'bytes')
