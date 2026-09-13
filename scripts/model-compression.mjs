import { Worker } from 'node:worker_threads';

// A single bounded worker keeps expensive codecs off the web server event loop.
export async function compressModel(bytes) {
  return new Promise((resolve, reject) => {
    const data = Uint8Array.from(bytes);
    const worker = new Worker(
      new URL('./model-compression-worker.mjs', import.meta.url),
      {
        workerData: data,
        execArgv: [],
        transferList: [data.buffer],
        resourceLimits: { maxOldGenerationSizeMb: 768 },
      },
    );
    let received = false;
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error('Compression timed out'));
    }, 180000);
    worker.once('message', (result) => {
      received = true;
      clearTimeout(timer);
      if (result.error)
        reject(new Error('Compression unavailable for this model'));
      else
        resolve(
          Buffer.from(
            result.bytes.buffer,
            result.bytes.byteOffset,
            result.bytes.byteLength,
          ),
        );
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 || !received)
        reject(new Error('Compression worker stopped'));
    });
  });
}
