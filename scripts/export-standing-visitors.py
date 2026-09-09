"""Export original standing bodies for rigid, supine rest. No inverse pose or morph.
blender --background --factory-startup --python scripts/export-standing-visitors.py
Reads the saved original surfaces; leaves every source project and v3 seated GLB intact.
"""
from pathlib import Path
import bpy, numpy as np, json, math
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
if bpy.data.filepath: raise RuntimeError('Use a fresh Blender document')
for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj,do_unlink=True)

def regions(kind, vertices, rgb):
 x,y,z=vertices.T;r,g,b=rgb.T
 if kind=='cat':
  hair=(z>.103)&((y>-.073)|(abs(x)>.107)|(z>.265))&(b>r*.98)&(g>.22)
  eye=(((abs(x)-.074)/.03)**2+((z-.203)/.028)**2<1)&(y<-.10)&(r>.20)&(r>g*1.2)&(b>g*1.12)
  top=(z>-.111)&(z<.111)&(r>.36)&(g>r*.91)&(b>r*.9)
  bottom=(z<-.092)&(z>-.256)&(abs(x)<.138)&(b>r*1.12)&(b<.46)
 elif kind=='bear':
  hair=(z>-.025)&(z<.322)&((y>-.128)|(abs(x)>.105)|(z>.228))&(r<.35)&(r>g*1.15)
  eye=(((abs(x)-.063)/.023)**2+((z-.244)/.024)**2<1)&(y<-.10)&(r>.06)&(r<.45)&(r>g*1.1)
  top=(z>.016)&(z<.141)&(abs(x)<.151)&(g>.32)&(r<g*1.4)&(b>g*.69)
  bottom=(z<.015)&(z>-.178)&(abs(x)<.147)&(r<.48)
 else:
  ornament=(((x-.15)/.072)**2+((z-.235)/.10)**2<1)&(y<-.15)
  hair=(z>-.165)&(y<.115)&(abs(x)<.27)&(g>.32)&(b>r*.95)&(~ornament)
  eye=(((abs(x)-.065)/.029)**2+((z-.124)/.027)**2<1)&(y<-.19)&(r>.2)&(r>g*1.2)&(b>g*1.09)
  cloth=(r<.31)&(g<.25)&(b<.28)&(r<g*1.6)&(y<.07)&(abs(x)<.20)
  top=cloth&(z>-.23)&(z<.014);bottom=cloth&(z<-.23)&(z>-.31)&(abs(x)<.10)
 result=np.zeros(len(vertices),np.int32)
 for i,mask in enumerate([hair,eye,top,bottom],1): result[mask]=i
 return result

poses={};report={}
for kind in ['bear','cat','fox']:
 library=ROOT/'assets/models'/('studio-visitor-fox-v3.blend' if kind=='fox' else 'studio-visitors-v3.blend')
 with bpy.data.libraries.load(str(library),link=False) as (src,dst):dst.objects=['Original '+kind]
 ob=dst.objects[0];bpy.context.scene.collection.objects.link(ob)
 ob.name='Standing '+kind;ob.hide_set(False);ob.hide_render=False;ob.matrix_world=Matrix.Identity(4)
 m=ob.data
 vertices=np.array([v.co[:] for v in m.vertices]);faces=np.array([list(p.vertices) for p in m.polygons])
 base=m.materials[0];bsdf=next(n for n in base.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 im=bsdf.inputs['Base Color'].links[0].from_node.image
 pixels=np.empty(len(im.pixels),np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(im.size[1],im.size[0],4)
 uv=np.array([l.uv[:] for l in m.uv_layers.active.data])
 samples=pixels[np.clip((uv[:,1]*im.size[1]).astype(int),0,im.size[1]-1),np.clip((uv[:,0]*im.size[0]).astype(int),0,im.size[0]-1),:3]
 indices=np.array([l.vertex_index for l in m.loops]);counts=np.bincount(indices,minlength=len(vertices));rgb=np.zeros((len(vertices),3));np.add.at(rgb,indices,samples);rgb/=np.maximum(counts[:,None],1)
 category=regions(kind,vertices[faces].mean(1),rgb[faces].mean(1))
 m.materials.clear();images={}
 for name in ['Original','TintHair','TintEyes','TintTop','TintBottom']:
  mat=base.copy();mat.name=kind+'_'+name
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image:
    source=node.image
    if source.name not in images:
     copy=source.copy();copy.name=kind+' standing '+source.name;copy.scale(2048,2048);copy.pack();images[source.name]=copy
    node.image=images[source.name]
  m.materials.append(mat)
 m.polygons.foreach_set('material_index',category)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 modifier=ob.modifiers.new('Preserve standing silhouette within web budget','DECIMATE');modifier.ratio=.56 if kind=='fox' else .68;modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
 # Normalization is one affine transform for the entire intact standing body.
 # The head remains in the same model coordinates used by the seated face landmarks.
 scale={'bear':1.27,'cat':1.46,'fox':1.15}[kind];contact={'bear':-.137,'cat':-.173,'fox':-.236}[kind]
 before=np.array([v.co[:] for v in m.vertices]);after=before.copy();after[:,2]-=contact;after*=scale
 m.vertices.foreach_set('co',after.astype(np.float32).ravel());m.update()
 for face in m.polygons:face.use_smooth=True
 edges=np.array([tuple(e.vertices) for e in m.edges]);old_lengths=np.linalg.norm(before[edges[:,0]]-before[edges[:,1]],axis=1);new_lengths=np.linalg.norm(after[edges[:,0]]-after[edges[:,1]],axis=1)
 error=float(np.max(np.abs(new_lengths-old_lengths*scale)))
 assert error<1e-6, 'Original standing body must never stretch locally'
 upright=np.stack([after[:,0],after[:,2],-after[:,1]],1)
 # Whole-character scaling keeps even the original, uncompressed fox tails within one bed half.
 fit=min(1.,1.16/float(np.ptp(upright[:,0])))
 pitch={'bear':.32,'cat':.30,'fox':0.0}[kind]
 angle=-math.pi/2+pitch;c=math.cos(angle);sn=math.sin(angle)
 rotated=np.stack([upright[:,0],c*upright[:,1]-sn*upright[:,2],sn*upright[:,1]+c*upright[:,2]],1)*fit
 head=rotated[upright[:,1]>{'bear':.35,'cat':.355,'fox':.30}[kind]]
 lift=max(-float(rotated[:,1].min())+.012,0 if kind=='fox' else .09-float(head[:,1].min()))
 poses[kind]={'scale':round(fit,7),'pitch':pitch,'lift':round(lift,7),'lengthOffset':0}
 rest=rotated+np.array([0,lift,0])
 poses[kind]['labelHeight']=round(float(rest[:,1].max())+.14,2)
 ob['pose']='Original standing figure; rest uses only whole-object rotation, uniform scale and translation'
 ob['character']=kind;ob['normalizationScale']=scale;ob['normalizationContact']=contact
 ob['standingEdgeError']=error
 target=ROOT/'public/models'/f'studio-visitor-{kind}-standing-v5.glb'
 bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_image_format='JPEG',export_jpeg_quality=92)
 report[kind]={'triangles':len(m.polygons),'bytes':target.stat().st_size,'edgeError':error,'bounds':[rest.min(0).tolist(),rest.max(0).tolist()]}
 print(kind,poses[kind],report[kind])
 ob.hide_set(True)
(ROOT/'app/visitor-rest-poses.json').write_text(json.dumps(poses,indent=2)+'\n')
(ROOT/'output/standing-rest-report.json').write_text(json.dumps(report,indent=2)+'\n')
# Save an approachable workshop: all original standing exports laid side by side.
for i,kind in enumerate(['bear','cat','fox']):
 ob=bpy.data.objects['Standing '+kind];ob.hide_set(False)
 ob.rotation_euler.x=-math.pi/2+poses[kind]['pitch'];ob.scale=(poses[kind]['scale'],)*3
 ob.location=( (i-1)*1.6,0,poses[kind]['lift'])
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/models/studio-standing-rest-v5.blend'),compress=True)
