/**
 * supabase.test.ts
 *
 * Testes unitários do módulo src/lib/supabase.ts
 * Verifica comportamento do cliente e validação de configuração.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.unmock('../lib/supabase');
vi.unmock('../../lib/supabase');

describe('[Unit] supabase.ts — validação de variáveis de ambiente', () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('deve criar o cliente quando as variáveis estão configuradas', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    // Reimportar para pegar as envs mockadas
    const { supabase } = await import('../../lib/supabase');
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });

  it('deve lançar erro quando VITE_SUPABASE_URL está ausente', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    await expect(import('../../lib/supabase')).rejects.toThrow(
      /Vari[aá]veis de ambiente obrigat[oó]rias/i
    );
  });

  it('deve lançar erro quando VITE_SUPABASE_ANON_KEY está ausente', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(import('../../lib/supabase')).rejects.toThrow(
      /Vari[aá]veis de ambiente obrigat[oó]rias/i
    );
  });
});

describe('[Unit] supabase.ts — exportações corretas', () => {
  it('deve exportar o cliente supabase', async () => {
    const mod = await import('../../lib/supabase');
    expect(mod.supabase).toBeDefined();
  });

  it('deve exportar storageBucket', async () => {
    const mod = await import('../../lib/supabase');
    expect(mod.storageBucket).toBe('delivery-photos');
  });

  it('deve exportar uploadDeliveryPhoto como função', async () => {
    const mod = await import('../../lib/supabase');
    expect(typeof mod.uploadDeliveryPhoto).toBe('function');
  });
});
