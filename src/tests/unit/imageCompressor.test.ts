import { describe, it, expect, vi } from 'vitest';
import { compressImage, compressImages } from '../../lib/imageCompressor';

describe('[Unit] imageCompressor.ts — compressão de imagens no cliente', () => {
  it('deve retornar o arquivo original se não for do tipo imagem', async () => {
    const pdf = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
    const result = await compressImage(pdf);
    expect(result).toBe(pdf);
  });

  it('deve retornar o arquivo original se ocorrer erro ao carregar a imagem', async () => {
    const file = new File(['fake-image'], 'broken.jpg', { type: 'image/jpeg' });

    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    const origImage = global.Image;
    global.Image = class {
      set src(_val: string) {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Event('error'));
        }, 0);
      }
      onerror: ((e: Event) => void) | null = null;
      onload: (() => void) | null = null;
    } as any;

    try {
      const result = await compressImage(file);
      expect(result).toBe(file);
    } finally {
      global.Image = origImage;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it('compressImages deve processar múltiplos arquivos', async () => {
    const f1 = new File(['1'], 'doc1.txt', { type: 'text/plain' });
    const f2 = new File(['2'], 'doc2.txt', { type: 'text/plain' });
    const results = await compressImages([f1, f2]);
    expect(results).toHaveLength(2);
    expect(results[0]).toBe(f1);
    expect(results[1]).toBe(f2);
  });
});
