// 음원 오프라인 저장(Cache Storage). archive.org 는 리디렉션 + CORS 가 필요하므로 실제로 저장되는지 확인한다.
const CACHE = 'pilsa-audio';

export async function cachedAudioBlob(url: string): Promise<Blob | null> {
  if (!('caches' in window)) return null;
  const c = await caches.open(CACHE);
  const r = await c.match(url);
  return r ? r.blob() : null;
}

export async function saveAudio(url: string, onProgress?: (loaded: number, total: number) => void): Promise<number> {
  if (!('caches' in window)) throw new Error('이 브라우저는 저장을 지원하지 않아요');
  const res = await fetch(url, { mode: 'cors', redirect: 'follow' });
  if (!res.ok || res.type === 'opaque') throw new Error('음원 서버가 저장을 허용하지 않아요');
  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body?.getReader();
  const parts: BlobPart[] = [];
  let loaded = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value as BlobPart);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
  }
  const blob = reader ? new Blob(parts, { type: res.headers.get('content-type') ?? 'audio/mpeg' }) : await res.blob();
  if (blob.size < 1000) throw new Error('받은 파일이 너무 작아요');
  const c = await caches.open(CACHE);
  await c.put(url, new Response(blob, { headers: { 'content-type': blob.type, 'content-length': String(blob.size) } }));
  return blob.size;
}

export async function deleteAudio(url: string) {
  if (!('caches' in window)) return;
  const c = await caches.open(CACHE);
  await c.delete(url);
}

export async function savedAudioList(): Promise<{ url: string; size: number }[]> {
  if (!('caches' in window)) return [];
  const c = await caches.open(CACHE);
  const keys = await c.keys();
  const out: { url: string; size: number }[] = [];
  for (const k of keys) {
    const r = await c.match(k);
    out.push({ url: k.url, size: Number(r?.headers.get('content-length') ?? 0) });
  }
  return out;
}

export const formatBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.round(n / 1e3)}KB`);
