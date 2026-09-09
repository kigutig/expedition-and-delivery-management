/**
 * security.test.ts
 *
 * Testes de segurança DevSecOps:
 * - Detecta credenciais hardcoded no código-fonte
 * - Verifica ausência de API secrets no frontend
 * - Valida configurações de segurança
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../../');

// ─── Utilitário: ler arquivo do projeto ──────────────────────────────────────
function readSource(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf-8');
}

// ─── Padrões que NUNCA devem aparecer no código-fonte frontend ────────────────
const FORBIDDEN_PATTERNS = [
  // Supabase hardcoded credentials (as que estavam no código antes)
  { pattern: /ynzlczkqtlytswxobnvc\.supabase\.co/, label: 'Supabase URL hardcoded' },
  { pattern: /sb_publishable_T4cZRqR95AOIIFj7c/, label: 'Supabase Anon Key hardcoded' },
  // Cloudinary API Secret
  { pattern: /CLOUDINARY_API_SECRET\s*=\s*['"`][^'"`]+['"`]/, label: 'Cloudinary API Secret hardcoded' },
  { pattern: /d2IpM2sUVUBoHDihCtrzdhW2aCs/, label: 'Cloudinary API Secret value hardcoded' },
  // Chave de API antiga
  { pattern: /338884337775122/, label: 'Cloudinary API Key hardcoded (deveria vir do .env)' },
  // Padrões genéricos de secrets
  { pattern: /password\s*=\s*['"`][^'"`]{8,}['"`]/i, label: 'Senha hardcoded' },
  { pattern: /secret\s*=\s*['"`][^'"`]{8,}['"`]/i, label: 'Secret hardcoded' },
];

// Arquivos do frontend que devem ser verificados
const FRONTEND_FILES = [
  'src/lib/supabase.ts',
  'src/lib/cloudinary.ts',
  'src/App.tsx',
  'src/main.tsx',
];

describe('[DevSecOps] Detecção de credenciais hardcoded', () => {
  FRONTEND_FILES.forEach((file) => {
    FORBIDDEN_PATTERNS.forEach(({ pattern, label }) => {
      it(`${file} não deve conter: ${label}`, () => {
        let content: string;
        try {
          content = readSource(file);
        } catch {
          // Arquivo pode não existir — não é falha de segurança
          return;
        }
        expect(content).not.toMatch(pattern);
      });
    });
  });
});

describe('[DevSecOps] Arquivo .env.example não deve conter credenciais reais', () => {
  it('não deve ter a URL real do Supabase', () => {
    const content = readSource('.env.example');
    expect(content).not.toContain('ynzlczkqtlytswxobnvc.supabase.co');
  });

  it('não deve ter a Anon Key real do Supabase', () => {
    const content = readSource('.env.example');
    expect(content).not.toContain('sb_publishable_');
  });

  it('não deve ter o API Secret do Cloudinary', () => {
    const content = readSource('.env.example');
    expect(content).not.toContain('d2IpM2sUVUBoHDihCtrzdhW2aCs');
  });

  it('deve ter a variável VITE_SUPABASE_URL documentada', () => {
    const content = readSource('.env.example');
    expect(content).toContain('VITE_SUPABASE_URL');
  });

  it('deve ter a variável VITE_CLOUDINARY_CLOUD_NAME documentada', () => {
    const content = readSource('.env.example');
    expect(content).toContain('VITE_CLOUDINARY_CLOUD_NAME');
  });
});

describe('[DevSecOps] .gitignore deve proteger arquivos sensíveis', () => {
  it('deve ignorar arquivos .env', () => {
    const gitignore = readSource('.gitignore');
    expect(gitignore).toMatch(/^\.env/m);
  });

  it('deve ignorar node_modules', () => {
    const gitignore = readSource('.gitignore');
    expect(gitignore).toContain('node_modules');
  });

  it('deve ignorar o diretório dist', () => {
    const gitignore = readSource('.gitignore');
    expect(gitignore).toContain('dist/');
  });
});

describe('[DevSecOps] index.html deve ter headers de segurança', () => {
  it('deve ter Content-Security-Policy', () => {
    const content = readSource('index.html');
    expect(content).toContain('Content-Security-Policy');
  });

  it('deve ter X-Frame-Options para prevenir clickjacking', () => {
    const content = readSource('index.html');
    expect(content).toContain('X-Frame-Options');
  });

  it('deve ter política de Referrer', () => {
    const content = readSource('index.html');
    expect(content).toContain('referrer');
  });
});

describe('[DevSecOps] cloudinary.ts não deve usar assinatura no cliente', () => {
  it('não deve importar nem usar CLOUDINARY_API_SECRET', () => {
    const content = readSource('src/lib/cloudinary.ts');
    expect(content).not.toContain('CLOUDINARY_API_SECRET');
    expect(content).not.toContain('API_SECRET');
  });

  it('deve usar a Edge Function para assinar (sign_cloudinary)', () => {
    const content = readSource('src/lib/cloudinary.ts');
    expect(content).toContain('sign_cloudinary');
  });

  it('não deve conter a função de assinatura SHA-1 localmente', () => {
    const content = readSource('src/lib/cloudinary.ts');
    // A função signCloudinaryParams foi removida — assinatura é server-side agora
    expect(content).not.toContain('function signCloudinaryParams');
  });
});

describe('[DevSecOps] supabase.ts deve validar variáveis de ambiente', () => {
  it('deve ter verificação de env vars obrigatórias', () => {
    const content = readSource('src/lib/supabase.ts');
    expect(content).toMatch(/if\s*\(!supabaseUrl|throw.*Error/);
  });

  it('não deve ter fallback com URL hardcoded', () => {
    const content = readSource('src/lib/supabase.ts');
    expect(content).not.toContain("|| 'https://");
  });
});
