import {
  readFile,
  writeFile,
  mkdir,
  lstat,
  readdir,
  realpath,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadEnv } from 'vite';
import {
  contentType,
  hashedPath,
  safePath,
  sha256,
  publicManifest,
} from './lib/asset-policy.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
async function writeChanged(file, data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (
    await readFile(file)
      .then((old) => old.equals(bytes))
      .catch(() => false)
  )
    return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
export async function prepareAssets({
  root = project,
  catalogFile = 'config/asset-catalog.json',
  output = 'public/assets',
  checkManifest = false,
} = {}) {
  root = await realpath(root);
  if (output !== 'public/assets')
    throw new Error('Generated output is restricted to public/assets');
  for (const dir of ['public', 'public/assets']) {
    const target = path.resolve(root, dir);
    const existing = await lstat(target).catch(() => null);
    if (existing && (existing.isSymbolicLink() || !existing.isDirectory()))
      throw new Error('Generated output must be a real directory');
  }
  const catalog = JSON.parse(
    await readFile(path.resolve(root, catalogFile), 'utf8'),
  );
  const destination = path.resolve(root, output);
  const assets = {},
    processing = new Set(),
    built = new Map();
  const byId = new Map(catalog.assets.map((entry) => [entry.id, entry]));
  if (byId.size !== catalog.assets.length)
    throw new Error('Duplicate logical asset ID');
  const paths = new Set();
  for (const entry of catalog.assets) {
    safePath(entry.source);
    safePath(entry.path);
    contentType(entry.path);
    if (paths.has(entry.path)) throw new Error(`Duplicate path: ${entry.path}`);
    paths.add(entry.path);
    if (!['approved', 'pending', 'denied'].includes(entry.approval))
      throw new Error(`Missing approval: ${entry.id}`);
    if (
      entry.approval === 'approved' &&
      (!entry.license || !entry.author || !entry.modifications)
    )
      throw new Error(`Missing license record: ${entry.id}`);
    // Never permit source formats just by giving them an allowed output extension.
    const inputExt = path.extname(entry.source).toLowerCase();
    contentType(
      entry.type === 'decoder'
        ? `decoders/${path.basename(entry.source)}`
        : entry.type === 'license'
          ? `licenses/${path.basename(entry.source)}`
          : path.basename(entry.source),
    );
    if (
      inputExt !== path.extname(entry.path) &&
      entry.transform !== 'webp-lossless'
    )
      throw new Error(`Conversion required: ${entry.id}`);
  }
  async function build(entry) {
    if (built.has(entry.id)) return built.get(entry.id);
    if (processing.has(entry.id))
      throw new Error(`Cyclic dependency: ${entry.id}`);
    processing.add(entry.id);
    const source = path.resolve(root, entry.source);
    const real = await realpath(source);
    if (
      !(await lstat(source)).isFile() ||
      real !== source ||
      !real.startsWith(path.resolve(root) + path.sep)
    )
      throw new Error(`Source must be a regular in-project file: ${entry.id}`);
    let data = await readFile(source);
    if (entry.sourceSha256 && sha256(data) !== entry.sourceSha256)
      throw new Error(
        `Source changed; review provenance and update catalog: ${entry.id}`,
      );
    const inputExt = path.extname(entry.source);
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(inputExt)) {
      const meta = await sharp(data).metadata();
      if (Math.max(meta.width || 0, meta.height || 0) > 2048)
        throw new Error(
          `Raw 4K/8K texture blocked; create <=2K production derivative: ${entry.id}`,
        );
    }
    let outputPath = entry.path;
    if (entry.transform === 'webp-lossless') {
      // Normal/roughness maps retain the decoded pixels. Keep the original 1K JPG
      // when lossless WebP is larger; albedo uses a small, high-quality WebP derivative.
      const albedo = /\/(Diffuse|col_1)\./.test(entry.source);
      const converted = await sharp(data)
        .webp(
          albedo ? { quality: 85, effort: 6 } : { lossless: true, effort: 6 },
        )
        .toBuffer();
      if (converted.length < data.length) data = converted;
      else outputPath = entry.path.replace(/\.webp$/, inputExt);
    }
    const dependencies = [];
    if (inputExt === '.gltf') {
      const gltf = JSON.parse(data.toString('utf8'));
      for (const resource of [
        ...(gltf.buffers || []),
        ...(gltf.images || []),
      ]) {
        if (!resource.uri || resource.uri.startsWith('data:')) continue;
        const id = entry.dependencies?.[resource.uri];
        const dependency = byId.get(id);
        if (!dependency)
          throw new Error(
            `Unreviewed glTF dependency: ${entry.id}/${resource.uri}`,
          );
        const result = await build(dependency);
        if (entry.approval === 'approved' && !result.publish)
          throw new Error(`Unapproved dependency: ${id}`);
        resource.uri = path.posix.relative(
          path.posix.dirname(entry.path),
          result.path,
        );
        dependencies.push(id);
      }
      data = Buffer.from(JSON.stringify(gltf));
    }
    if (inputExt === '.glb') {
      if (
        data.readUInt32LE(0) !== 0x46546c67 ||
        data.readUInt32LE(4) !== 2 ||
        data.readUInt32LE(8) !== data.length
      )
        throw new Error(`Invalid GLB: ${entry.id}`);
      const gltf = JSON.parse(
        data.toString('utf8', 20, 20 + data.readUInt32LE(12)),
      );
      for (const resource of [
        ...(gltf.buffers || []),
        ...(gltf.images || []),
      ]) {
        if (resource.uri && !resource.uri.startsWith('data:'))
          throw new Error(`GLB must embed dependencies: ${entry.id}`);
        if (
          resource.bufferView !== undefined &&
          gltf.images?.includes(resource)
        ) {
          const view = gltf.bufferViews[resource.bufferView];
          const start = 28 + data.readUInt32LE(12) + (view.byteOffset || 0);
          const meta = await sharp(
            data.subarray(start, start + view.byteLength),
          ).metadata();
          if (Math.max(meta.width || 0, meta.height || 0) > 2048)
            throw new Error(`GLB embeds raw >2K image: ${entry.id}`);
        }
      }
    }
    const result = {
      type: entry.type,
      room: entry.room,
      rooms: entry.rooms,
      path: hashedPath(outputPath, data),
      logicalPath: entry.path,
      size: data.length,
      sha256: sha256(data),
      contentType: contentType(outputPath),
      dependencies,
      publish: entry.approval === 'approved',
    };
    if (entry.approval !== 'denied')
      await writeChanged(path.join(destination, result.path), data);
    built.set(entry.id, result);
    processing.delete(entry.id);
    return result;
  }
  for (const entry of [...catalog.assets].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (entry.approval === 'denied')
      throw new Error(
        `Remove or replace prohibited runtime resource: ${entry.id}`,
      );
    assets[entry.id] = await build(entry);
  }
  const manifest = {
    schemaVersion: 1,
    version: sha256(JSON.stringify(assets)).slice(0, 16),
    assets,
  };
  if (checkManifest) {
    const previous = JSON.parse(
      await readFile(
        path.resolve(root, 'app/generated/asset-manifest.json'),
        'utf8',
      ),
    );
    if (previous.version !== manifest.version)
      throw new Error(
        'Production asset bytes differ from the reviewed manifest. Run assets:prepare, upload and verify from this build environment before switching the release.',
      );
  }
  const json = (v) => JSON.stringify(v, null, 2) + '\n';
  await writeChanged(
    path.resolve(root, 'app/generated/asset-manifest.json'),
    json(manifest),
  );
  await writeChanged(
    path.join(destination, 'manifests/assets.json'),
    json(publicManifest(manifest)),
  );
  // This directory is generated and git-ignored. Remove only stale generated files;
  // original public/models, public/materials and authoring sources are untouched.
  const keep = new Set([
    ...Object.values(assets).map((a) => a.path),
    'manifests/assets.json',
  ]);
  async function removeStale(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink())
        throw new Error('Symlinks are forbidden in generated output');
      if (entry.isDirectory())
        await removeStale(path.join(dir, entry.name), relative + '/');
      else if (!keep.has(relative)) await unlink(path.join(dir, entry.name));
    }
  }
  await removeStale(destination);
  const credits = catalog.assets
    .filter((a) => a.approval === 'approved' && a.type !== 'license')
    .map((a) => ({
      id: a.id,
      name: a.name || a.id,
      author: a.author,
      sourceUrl: a.sourceUrl,
      license: a.license,
      licenseUrl: a.licenseUrl || '',
      modifications: a.modifications,
      rooms: a.rooms,
      attributionRequired: a.license.startsWith('CC-BY'),
    }));
  await writeChanged(
    path.resolve(root, 'app/generated/asset-credits.json'),
    json(credits),
  );
  const roomSizes = Object.fromEntries(
    ['study', 'living', 'bedroom', 'gallery', 'cafe'].map((room) => {
      const entries = Object.values(assets).filter(
        (a) => a.rooms.includes(room) && a.room !== 'common',
      );
      return [
        room,
        {
          bytes: entries.reduce((sum, a) => sum + a.size, 0),
          files: entries.length,
        },
      ];
    }),
  );
  const common = Object.values(assets).filter(
    (a) => a.type === 'model' && a.room === 'common',
  );
  const sources = new Set(catalog.assets.map((a) => a.source));
  const inventory = [];
  async function scan(dir) {
    const entries = await readdir(path.resolve(root, dir), {
      withFileTypes: true,
    }).catch((error) => {
      if (error.code === 'ENOENT' && dir === 'assets') return [];
      throw error;
    });
    for (const entry of entries) {
      const file = `${dir}/${entry.name}`;
      if (file === output) continue;
      if (entry.isDirectory()) await scan(file);
      else
        inventory.push({
          path: file,
          bytes: (await lstat(path.resolve(root, file))).size,
          classification:
            file === 'public/favicon.svg'
              ? 'entry-asset-retained-on-railway'
              : sources.has(file)
                ? 'catalogued-production'
                : /\.(blend\d*|fbx|obj|psd|wav|zip|7z)$/i.test(file)
                  ? 'forbidden-source'
                  : 'excluded-unused-or-documentation',
        });
    }
  }
  await scan('public');
  await scan('assets');
  const report = {
    version: manifest.version,
    roomSizes,
    commonCharacters: {
      files: common.length,
      bytes: common.reduce((s, a) => s + a.size, 0),
    },
    pending: catalog.assets
      .filter((a) => a.approval !== 'approved')
      .map((a) => a.id),
    inventory,
  };
  await writeChanged(
    path.resolve(root, 'docs/assets-inventory.json'),
    json(report),
  );
  return { manifest, report };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  prepareAssets({
    checkManifest:
      process.argv.includes('--build') &&
      !!(
        process.env.VITE_ASSET_BASE_URL ||
        loadEnv('production', project, 'VITE_').VITE_ASSET_BASE_URL
      ),
  })
    .then(({ manifest, report }) => {
      console.log(
        `Prepared ${Object.keys(manifest.assets).length} assets; version ${manifest.version}; ${report.pending.length} blocked from public upload.`,
      );
      console.log(JSON.stringify(report.roomSizes));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
