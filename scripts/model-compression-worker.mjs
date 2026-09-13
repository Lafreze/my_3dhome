import { parentPort, workerData } from 'node:worker_threads';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

try {
  sharp.cache(false);
  sharp.concurrency(1);
  const input = Buffer.from(workerData);
  const json = JSON.parse(
    input.toString('utf8', 20, 20 + input.readUInt32LE(12)),
  );
  const supported = new Set(
    ALL_EXTENSIONS.map((extension) => extension.EXTENSION_NAME),
  );
  // Never strip an unfamiliar material, animation or vendor extension while optimizing.
  if (
    (json.extensionsUsed || []).some((extension) => !supported.has(extension))
  )
    throw Error('Unsupported extension');
  // Small encoded assets have already been optimized; avoid repeated lossy quantization.
  if (
    input.length < 5 * 1024 * 1024 &&
    (json.extensionsUsed || []).some((e) => /draco|meshopt/.test(e))
  ) {
    parentPort.postMessage({ bytes: workerData }, [workerData.buffer]);
  } else {
    await MeshoptDecoder.ready;
    const io = new NodeIO()
      .setLogger(new Logger(Logger.Verbosity.SILENT))
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule(),
        'meshopt.decoder': MeshoptDecoder,
      });
    const document = await io.readBinary(workerData);
    await document.transform(
      draco({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [2048, 2048],
        slots: /baseColorTexture|emissiveTexture/,
        quality: 90,
      }),
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [2048, 2048],
        slots: /normalTexture|metallicRoughnessTexture|occlusionTexture/,
        lossless: true,
      }),
    );
    const result = await io.writeBinary(document);
    parentPort.postMessage({ bytes: result }, [result.buffer]);
  }
} catch {
  parentPort.postMessage({ error: true });
}
