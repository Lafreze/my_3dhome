import type { Exhibit } from './exhibit-data';

export async function uploadModelFile(
  file: File,
  metadata: {
    title: string;
    description: string;
    visibility: 'public' | 'private';
    compress: boolean;
  },
  request: (
    path: string,
    body: unknown,
    method?: 'POST' | 'PATCH' | 'DELETE',
  ) => Promise<unknown>,
  csrf: () => string,
  onProgress?: (message: string) => void,
): Promise<Exhibit> {
  const job = (await request('/api/admin/model-uploads', {
    bytes: file.size,
    metadata,
  })) as { id: string; chunkBytes: number };
  const path = '/api/admin/model-uploads/' + job.id;
  let processing = false;
  try {
    for (
      let offset = 0, index = 0;
      offset < file.size;
      offset += job.chunkBytes, index++
    ) {
      let uploaded = false;
      for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
        try {
          const response = await fetch(path + '/' + index, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Studio-CSRF': csrf(),
            },
            body: file.slice(offset, offset + job.chunkBytes),
            signal: AbortSignal.timeout(90000),
          });
          if (!response.ok) {
            const value = await response.json();
            throw Object.assign(Error(value.error || '上传失败'), {
              status: response.status,
            });
          }
          uploaded = true;
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (attempt === 2 || (status && status < 500)) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 700 * (attempt + 1)),
          );
        }
      }
      onProgress?.(
        `上传中 ${Math.round((Math.min(file.size, offset + job.chunkBytes) / file.size) * 100)}%`,
      );
    }
    await request(path + '/complete', {});
    processing = true;
    onProgress?.(metadata.compress ? '正在压缩并保存…' : '正在保存…');
    // The task continues server-side, so a codec never holds one HTTP request open.
    for (let poll = 0; poll < 600; poll++) {
      const response = await fetch(path, { cache: 'no-store' });
      const value = await response.json();
      if (!response.ok) throw Error(value.error || '无法读取处理进度');
      if (value.state === 'complete') return value.item as Exhibit;
      if (value.state === 'failed') throw Error(value.error || '模型保存失败');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw Error('模型仍在处理中，请稍后刷新管理列表查看。');
  } catch (error) {
    if (!processing) await request(path, {}, 'DELETE').catch(() => {});
    throw error;
  }
}
