"""Create two web LODs from the supplied GLBs without changing the originals.
Run with Blender --background --python scripts/prepare-gallery-models.py.
"""
import bpy, json, math, pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = [
    ('seraph', 'Hi3D_科幻神圣天使机甲战士3D模型_allparts_20260913_171753.glb'),
    ('reaper', 'Hi3D_风格化黑暗赛博朋克死神机甲3D模型_allparts_20260913_171724.glb'),
    ('aureole', 'Hi3D_精致鎏金带翼神圣机甲天使3D模型_allparts_20260913_171105.glb'),
]
out = ROOT / 'public/models/exhibits'
out.mkdir(parents=True, exist_ok=True)
report = []
for key, filename in SOURCES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = pathlib.Path.home() / 'Downloads' / filename
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    original_triangles = sum(len(o.data.polygons) for o in meshes)
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for poly in o.data.polygons: poly.use_smooth = True
    # Preserve original painted color and normal maps in both versions.
    for image in bpy.data.images:
        if image.size[0] > 2048 or image.size[1] > 2048:
            factor = 2048 / max(image.size)
            image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
            image.pack()
    source_geometry = {o.name: o.data.copy() for o in meshes}
    for lod, target in [('detail', 300000), ('room', 90000)]:
        for o in meshes:
            old = o.data
            o.data = source_geometry[o.name].copy()
            if old.users == 0: bpy.data.meshes.remove(old)
        ratio = min(1, target / sum(len(m.data.polygons) for m in meshes))
        for o in meshes:
            bpy.context.view_layer.objects.active = o
            count = len(o.data.polygons)
            modifier = o.modifiers.new('Web silhouette LOD', 'DECIMATE')
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        if lod == 'room':
            for image in bpy.data.images:
                if max(image.size) > 1024:
                    factor = 1024 / max(image.size)
                    image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
                    image.pack()
        path = out / f'{key}-{lod}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
            use_selection=False, export_animations=False, export_cameras=False,
            export_lights=False, export_image_format='JPEG', export_jpeg_quality=90,
            export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
            export_draco_position_quantization=16, export_draco_normal_quantization=12,
            export_draco_texcoord_quantization=14)
        report.append({'id': key, 'lod': lod, 'source': filename,
            'sourceTriangles': original_triangles,
            'triangles': sum(len(o.data.polygons) for o in meshes),
            'bytes': path.stat().st_size})
        print('GALLERY_LOD', json.dumps(report[-1]), flush=True)
(ROOT / 'docs/gallery-model-build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
