"""Original seated character, authored through the local Blender MCP connection.
Blender Z up / facing -Y; glTF Y up / facing +Z. Seat contact is local Z=0.
Run in a separate Blender document. No downloaded character meshes are used.
"""
import bpy, math, random, os
from mathutils import Vector
random.seed(12)
ROOT = '/Users/satori/Documents/my_3d_test'
scene = bpy.context.scene
# Only clear the dedicated visitor document, never another open project.
if scene.name not in ('Scene', 'Studio Visitor'):
    raise RuntimeError('Open a dedicated visitor document first')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene.name = 'Studio Visitor'

def mat(name, color, rough=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    return m
skin=mat('Warm porcelain skin',(.72,.365,.213),.62)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.075
blush=mat('Warm ears and cheeks',(.67,.245,.145),.72)
cream=mat('Oatmeal cotton knit',(.84,.77,.64),.9)
rib=mat('Ribbed cotton edges',(.72,.65,.53),.93)
sage=mat('Sage cotton twill',(.265,.305,.22),.91)
seam=mat('Sage stitching',(.34,.365,.265),.88)
hair=mat('Chestnut sculpted curls',(.061,.027,.014),.39)
hairLight=mat('Chestnut strand ridges',(.115,.054,.029),.49)
hairMid=mat('Chocolate swept locks',(.083,.035,.019),.43)
sole=mat('Ivory rubber sole',(.7,.638,.52),.86)
shoe=mat('Cream suede sneakers',(.86,.79,.65),.88)
lace=mat('Cotton shoelaces',(.93,.867,.734),.87)
white=mat('Warm eye whites',(.94,.918,.84),.26)
iris=mat('Hazel irises',(.145,.054,.016),.24)
pupil=mat('Deep brown pupils',(.009,.004,.003),.22)
glint=mat('Eye catchlights',(.99,.99,.98),.08)
mouth=mat('Soft smile',(.27,.078,.035),.64)

# Exportable UV micro-textures: a tiled knit and fine twill, shared by all visitors.
for material,kind in [(cream,'knit'),(sage,'twill')]:
    size=256;im=bpy.data.images.new('Visitor '+kind,size,size);pix=[]
    for y in range(size):
        for x in range(size):
            if kind=='knit':
                u=(x%32)/32;v=(y%32)/32
                ridge=math.exp(-((u-(.22+.28*abs(v*2-1)))/.052)**2)+math.exp(-((u-(.78-.28*abs(v*2-1)))/.052)**2)
                q=.56+ridge*.19+random.random()*.05
            else:q=.63+.18*math.sin((x+y)*math.pi/5)+random.random()*.035
            pix.extend((q,q,q,1))
    im.pixels=pix;im.pack()
    nodes=material.node_tree.nodes;links=material.node_tree.links
    tex=nodes.new('ShaderNodeTexImage');tex.image=im
    uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=4
    links.new(uv.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.004
    links.new(tex.outputs['Color'],bump.inputs['Height']);links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
    # Multiplicative color detail also survives glTF without procedural nodes.
    color=material.diffuse_color[:3]
    im.pixels=[v for i in range(size*size) for v in (*[min(1,color[j]*(.83+pix[i*4]*.26)) for j in range(3)],1)]
    links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])

def empty(name,position=(0,0,0),parent=None):
    ob=bpy.data.objects.new(name,None);scene.collection.objects.link(ob);ob.location=position;ob.parent=parent;return ob
avatar=empty('StudioVisitor');body=empty('Body',parent=avatar)
head=empty('Head',(0,0,1.16),avatar)
parts=[]
def finish(ob,name,m,parent=body):
    ob.name=name;ob.data.materials.append(m);ob.parent=parent
    if ob.type=='MESH':
        for p in ob.data.polygons:p.use_smooth=True
    parts.append(ob);return ob
def oval(name,p,s,m,parent=body,segments=24,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=p)
    ob=finish(bpy.context.object,name,m,parent);ob.scale=s;return ob
def cube(name,p,s,m,r=.025,parent=body):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=finish(bpy.context.object,name,m,parent);o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Tailored rounded edge','BEVEL');mod.width=r;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Weighted soft normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def curve(name,points,r,m,parent=body):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=10;c.bevel_depth=r;c.bevel_resolution=2
    sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for a,p in zip(sp.bezier_points,points):a.co=p;a.handle_left_type='AUTO';a.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,c);scene.collection.objects.link(ob);finish(ob,name,m,parent);return ob
def link(name,a,b,rx,ry,m,parent=body):
    a,b=Vector(a),Vector(b);o=oval(name,(a+b)/2,(rx,ry,(b-a).length/2+min(rx,ry)*.5),m,parent)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

# Seated torso, shaped hips, bent thighs and genuinely separate lower legs.
oval('Soft trouser seat',(0,.008,.137),(.245,.185,.14),sage)
oval('Sweater body',(0,.012,.485),(.244,.163,.325),cream)
oval('Lower sweater hem',(0,-.006,.259),(.246,.168,.071),rib)
for i in range(40):
    a=i*math.tau/40
    curve('Hem knit rib',[(math.cos(a)*.242,math.sin(a)*.162,.23),(math.cos(a)*.247,math.sin(a)*.169,.276)],.002,cream)
oval('Neck',(0,.004,.817),(.098,.087,.127),skin)
curve('Crew neck rib',[(math.cos(a)*.112,math.sin(a)*.091,.763+math.sin(a)*.026) for a in [i*math.tau/32 for i in range(33)]],.016,rib)
for s,word in [(-1,'Left'),(1,'Right')]:
    x=s*.147
    link('Seated thigh '+word,(x,.015,.144),(x,-.355,.11),.139,.137,sage)
    oval('Knee '+word,(x,-.348,.103),(.135,.125,.145),sage)
    curve('Trouser outer seam',[(x+s*.129,.03,.16),(x+s*.135,-.17,.17),(x+s*.129,-.35,.10)],.0024,seam)
    curve('Pocket welt',[(s*.185,-.108,.25),(s*.213,-.071,.188),(s*.216,.035,.157)],.003,seam)
    for i in range(3):
        curve('Fold above knee',[(x-.097,-.29-i*.025,.2-i*.017),(x,-.314-i*.024,.225-i*.019),(x+.08,-.299-i*.025,.203-i*.017)],.0025,seam)
    calf=empty('Calf'+word,(x,-.35,.08),avatar)
    link('Tapered lower trouser',(0,0,-.016),(0,.003,-.60),.102,.105,sage,calf)
    oval('Turned up trouser cuff',(0,0,-.594),(.109,.108,.041),sage,calf)
    curve('Cuff seam',[(math.cos(a)*.108,math.sin(a)*.106,-.61) for a in [i*math.tau/24 for i in range(25)]],.002,seam,calf)
    foot=empty('Foot'+word,(x,-.365,-.63),avatar)
    cube('Layered rubber sole',(0,-.063,-.048),(.222,.379,.063),sole,.031,foot)
    cube('Stitched midsole',(0,-.068,-.016),(.217,.377,.028),lace,.028,foot)
    oval('Suede shoe upper',(0,-.039,.025),(.105,.174,.088),shoe,foot)
    oval('Round toe cap',(0,-.169,.008),(.102,.075,.06),shoe,foot)
    cube('Heel pull tab',(0,.097,.071),(.058,.023,.062),lace,.008,foot)
    cube('Soft tongue',(0,-.015,.093),(.115,.17,.027),shoe,.017,foot)
    for i in range(4):
        yy=-.085+i*.034
        for ss in [-1,1]:oval('Metal eyelet',(ss*.055,yy,.103),(.009,.01,.004),sole,foot,12,8)
        curve('Crossed cotton lace',[(-.055,yy,.105),(0,yy+.014,.116),(.055,yy+.032,.105)],.005,lace,foot)
    curve('Lace bow',[(-.014,.061,.11),(-.06,.10,.12),(-.063,.04,.125),(0,.06,.119),(.053,.101,.122),(.063,.04,.123),(.006,.06,.117)],.0045,lace,foot)
    for i in range(11):
        yy=-.2+i*.026
        for ss in [-1,1]:curve('Rubber sole scoring',[(ss*.107,yy,-.056),(ss*.11,yy,-.037)],.0016,shoe,foot)
    # Arms rest ahead of the body, with cuff ribs and individually rounded fingers.
    link('Upper sleeve',(s*.217,.006,.668),(s*.28,-.104,.45),.098,.094,cream)
    link('Lower sleeve',(s*.28,-.104,.45),(s*.19,-.303,.345),.085,.079,cream)
    link('Turnback cuff',(s*.2,-.286,.353),(s*.183,-.325,.33),.089,.068,rib)
    oval('Palm on knee',(s*.173,-.356,.302),(.079,.044,.076),skin)
    for f in range(4):
        fx=s*.173+(f-1.5)*.032
        link('Relaxed finger',(fx,-.382,.3),(fx,-.405,.236+abs(f-1.5)*.009),.015,.014,skin)
        oval('Tiny fingernail',(fx,-.419,.25+abs(f-1.5)*.009),(.009,.002,.012),blush,segments=12,rings=8)
    link('Thumb',(s*.233,-.356,.309),(s*.244,-.4,.274),.022,.02,skin)

# Friendly face; all coordinates below are relative to the head pivot.
oval('Sculpted head',(0,0,0),(.285,.232,.304),skin,head,48,32)
oval('Soft jaw',(0,-.027,-.15),(.219,.197,.158),skin,head,32,20)
for s in [-1,1]:
    oval('Ear',(s*.285,0,-.035),(.072,.045,.105),skin,head)
    oval('Ear concha',(s*.30,-.034,-.034),(.038,.012,.065),blush,head)
    oval('Ear inner fold',(s*.293,-.046,-.054),(.019,.012,.041),skin,head)
    oval('Cheek',(s*.17,-.172,-.107),(.07,.045,.059),skin,head)
    x=s*.108
    oval('Eye white',(x,-.218,.016),(.08,.029,.092),white,head)
    oval('Hazel iris',(x+s*.004,-.245,.017),(.043,.013,.055),iris,head)
    oval('Deep pupil',(x+s*.004,-.257,.018),(.023,.005,.035),pupil,head)
    oval('Large catchlight',(x-.012,-.264,.042),(.011,.004,.014),glint,head,16,10)
    oval('Small catchlight',(x+.018,-.262,.001),(.004,.002,.005),glint,head,12,8)
    curve('Soft lower lid',[(x-.07,-.22,-.015),(x,-.239,-.068),(x+.07,-.219,-.015)],.007,skin,head)
    curve('Upper eyelash',[(x-.075,-.219,.022),(x-.044,-.235,.092),(x+.018,-.242,.11),(x+.071,-.218,.053)],.0055,hair,head)
    curve('Expressive eyebrow',[(x-.074,-.187,.141),(x-.014,-.211,.163),(x+.062,-.184,.153)],.018,hairMid,head)
oval('Button nose',(0,-.246,-.075),(.049,.054,.037),skin,head)
for s in [-1,1]:oval('Subtle nostril',(s*.024,-.277,-.092),(.009,.004,.004),blush,head,12,8)
curve('Gentle smile',[(-.096,-.207,-.151),(-.04,-.227,-.165),(.02,-.232,-.167),(.085,-.214,-.148)],.005,mouth,head)
curve('Lower lip',[(-.049,-.223,-.181),(0,-.232,-.188),(.053,-.219,-.178)],.005,skin,head)

# Layered curls follow the scalp, with tapering tips and raised strand ridges.
def lock(points,width,index):
    pts=[Vector(p) for p in points];verts=[];faces=[];n=len(pts);radial=8
    for i,p in enumerate(pts):
        tangent=(pts[min(n-1,i+1)]-pts[max(0,i-1)]).normalized()
        side=tangent.cross(Vector((0,0,1)))
        if side.length<.01:side=tangent.cross(Vector((0,1,0)))
        side.normalize();up=tangent.cross(side).normalized()
        r=width*(.28+.72*math.sin(math.pi*(i+.8)/(n+.6))**.7)
        if i==n-1:r=.004
        for j in range(radial):
            a=j*math.tau/radial;verts.append(p+side*math.cos(a)*r+up*math.sin(a)*r*.63)
    for i in range(n-1):
        for j in range(radial):
            a=i*radial+j;b=i*radial+(j+1)%radial;faces.append((a,b,b+radial,a+radial))
    faces.extend([tuple(reversed(range(radial))),tuple((n-1)*radial+j for j in range(radial))])
    me=bpy.data.meshes.new('Flowing lock');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new('Swept curl %02d'%index,me);scene.collection.objects.link(ob);finish(ob,ob.name,[hair,hairMid][index%2],head)
    for off in [-.3,0,.3]:
        strand=[]
        for i,p in enumerate(pts[1:-1],1):
            normal=Vector((p.x,p.y,p.z*.6)).normalized()
            strand.append(p+normal*width*.58+Vector((off*width,0,0)))
        curve('Fine hair strand',strand,.0018,hairLight,head)

# Scalp only covers crown/back, preserving the forehead and the ears.
verts=[];faces=[]
for i in range(13):
    t=i/12
    for j in range(48):
        phi=j*math.tau/48
        edge=.90+.70*(math.sin(phi)+1)/2
        theta=.01+t*edge
        verts.append((.294*math.sin(theta)*math.cos(phi),.245*math.sin(theta)*math.sin(phi),.318*math.cos(theta)))
for i in range(12):
    for j in range(48):faces.append((i*48+j,i*48+(j+1)%48,(i+1)*48+(j+1)%48,(i+1)*48+j))
me=bpy.data.meshes.new('Shaped scalp');me.from_pydata(verts,[],faces);me.update()
ob=bpy.data.objects.new('Hair foundation',me);scene.collection.objects.link(ob);finish(ob,'Hair foundation',hair,head)
index=0
for row,count in [(0,7),(1,12),(2,17)]:
    for j in range(count):
        phi=j*math.tau/count + row*.23;theta=.22+row*.36
        points=[]
        for k in range(13):
            t=k/12;ang=phi+.67*t+.11*math.sin(t*math.tau);th=theta+.51*t
            # Front locks stop higher than the hair at the back.
            th=min(th,1.01 if math.sin(ang)<-.4 else 1.65)
            puff=math.sin(t*math.pi)*.034
            points.append(((.301+puff)*math.sin(th)*math.cos(ang),(.25+puff)*math.sin(th)*math.sin(ang),(.332+puff)*math.cos(th)))
        lock(points,.04+row*.007,index);index+=1
for j in range(6):
    x=-.21+j*.067
    lock([(x+.095*math.sin(t*math.pi),-.15-.092*t,.25+.075*math.sin(t*math.pi)-.16*t) for t in [k/14 for k in range(15)]],.045,index);index+=1

# Convert curves and batch each material within its rigid animation node.
for ob in list(parts):
    if ob.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
for parent in [body,head]+[o for o in avatar.children if o.name.startswith(('Calf','Foot'))]:
    mats={o.data.materials[0] for o in parent.children if o.type=='MESH'}
    for material in mats:
        children=[o for o in parent.children if o.type=='MESH' and o.data.materials[0]==material]
        bpy.ops.object.select_all(action='DESELECT')
        for o in children:o.select_set(True)
        bpy.context.view_layer.objects.active=children[0];bpy.ops.object.join();children[0].name=parent.name+' / '+material.name

bpy.ops.object.select_all(action='DESELECT')
avatar.select_set(True)
for o in avatar.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=avatar
os.makedirs(ROOT+'/public/models',exist_ok=True);os.makedirs(ROOT+'/assets/models',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/studio-visitor.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)

# A studio preview is kept in the source document, excluded from the web asset.
floor=mat('Preview background',(.76,.71,.61),.92)
cube('Preview stool',(0,.055,-.115),(.62,.46,.15),floor,.04,None)
cube('Preview floor',(0,0,-.795),(200,200,.1),floor,.01,None)
scene.world.color=(.55,.55,.55)
for name,pos,power,size in [('Key',(-3,-4,5),450,4),('Fill',(3,-2,3),220,3),('Rim',(1,2,4),330,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.4))-ob.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Visitor portrait');cam=bpy.data.objects.new('Visitor portrait',camdata);scene.collection.objects.link(cam)
cam.location=(2.35,-4.7,2.0);cam.rotation_euler=(Vector((0,-.06,.42))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=2.75;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.filepath=ROOT+'/output/visitor-blender-preview.png'
os.makedirs(ROOT+'/output',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/models/studio-visitor.blend')
print('Visitor exported:',sum(len(o.data.polygons) for o in avatar.children_recursive if o.type=='MESH'),'polygons')
bpy.ops.render.render(write_still=True)
