/**
 * cloudinary.test.ts
 *
 * Testes unitários do módulo src/lib/cloudinary.ts
 * Verifica que:
 * - A assinatura não é feita localmente (API Secret não está no cliente)
 * - O upload chama a Edge Function para obter assinatura
 * - Validação de tamanho de vídeo funciona
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock da Edge Function de assinatura
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock do imageCompressor
vi.mock('../../lib/imageCompressor', () => ({
  compressImage: vi.fn().mockImplementation((file: File) => Promise.resolve(file)),
}));

describe('[Unit] cloudinary.ts — segurança: assinatura server-side', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'test-cloud');
    vi.stubEnv('VITE_CLOUDINARY_API_KEY', 'test-api-key');
    vi.stubEnv('VITE_CLOUDINARY_SIGN_URL', '/functions/v1/sign_cloudinary');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('não deve definir CLOUDINARY_API_SECRET como variável de módulo', async () => {
    const mod = await import('../../lib/cloudinary');
    // O módulo não deve expor o secret
    expect((mod as any).CLOUDINARY_API_SECRET).toBeUndefined();
  });

  it('uploadImageToCloudinary deve chamar a Edge Function de assinatura', async () => {
    // Mock: Edge Function retorna assinatura válida
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature: 'abc123',
        timestamp: 1700000000,
        api_key: 'test-api-key',
        cloud_name: 'test-cloud',
      }),
    });

    // Mock: Cloudinary retorna sucesso
    const xhrMock = {
      open: vi.fn(),
      send: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn().mockImplementation((event: string, cb: Function) => {
        if (event === 'load') {
          // Simula resposta bem-sucedida
          setTimeout(() => {
            Object.defineProperty(xhrMock, 'status', { value: 200, writable: true });
            Object.defineProperty(xhrMock, 'responseText', {
              value: JSON.stringify({
                public_id: 'test/image',
                secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/test/image.jpg',
                url: 'http://res.cloudinary.com/test-cloud/image/upload/test/image.jpg',
                original_filename: 'test',
                format: 'jpg',
              }),
              writable: true,
            });
            cb();
          }, 0);
        }
      }),
    };
    global.XMLHttpRequest = vi.fn(() => xhrMock) as any;

    const { uploadImageToCloudinary } = await import('../../lib/cloudinary');
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    await expect(uploadImageToCloudinary(file, 'test-folder')).resolves.toMatchObject({
      public_id: 'test/image',
      secure_url: expect.stringContaining('cloudinary.com'),
    });

    // Verifica que a Edge Function foi chamada (não assinou localmente)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sign_cloudinary'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('[Unit] cloudinary.ts — validação de vídeo', () => {
  it('deve rejeitar vídeos maiores que 200 MB', async () => {
    const { uploadVideoToCloudinary } = await import('../../lib/cloudinary');

    const bigFile = new File(['x'.repeat(201 * 1024 * 1024)], 'big.mp4', {
      type: 'video/mp4',
    });

    await expect(uploadVideoToCloudinary(bigFile)).rejects.toThrow(/muito grande/);
  });
});
