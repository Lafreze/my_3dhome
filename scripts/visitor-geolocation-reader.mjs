import { open } from 'maxmind';

// This large reader lives only in a disposable process, not the web server heap.
const reader = await open(process.argv[2]);
const name = (value) => value?.names?.['zh-CN'] || value?.names?.en || '';
process.on('message', ({ id, ip }) => {
  try {
    const record = reader.get(ip);
    const location =
      [
        ...new Set(
          [
            name(record?.country),
            ...(record?.subdivisions || []).map(name),
            name(record?.city),
          ].filter(Boolean),
        ),
      ].join(' · ') || '归属地未知';
    process.send({ id, location });
  } catch {
    process.send({ id, location: '归属地未知' });
  }
});
