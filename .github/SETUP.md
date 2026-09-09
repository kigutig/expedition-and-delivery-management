## 🔒 Configuração de Secrets no GitHub

Para o CI/CD funcionar, adicione os seguintes secrets em:
`Settings → Secrets and variables → Actions → New repository secret`

### Secrets Obrigatórios (Produção)

| Secret | Descrição |
|--------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase de produção |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública do Supabase |
| `VITE_CLOUDINARY_CLOUD_NAME` | Nome do cloud no Cloudinary |
| `VITE_CLOUDINARY_API_KEY` | API Key pública do Cloudinary |
| `VITE_CLOUDINARY_SIGN_URL` | `/functions/v1/sign_cloudinary` |
| `VITE_FENIX_GUIDE_PDF_URL` | URL pública do PDF da garantia |

### Secrets de Deploy (Vercel)

| Secret | Como obter |
|--------|-----------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `vercel env pull` ou dashboard do projeto |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` após `vercel link` |

### Secrets de Staging (Opcional)

| Secret | Descrição |
|--------|-----------|
| `STAGING_VITE_SUPABASE_URL` | URL do Supabase de staging |
| `STAGING_VITE_SUPABASE_ANON_KEY` | Anon key do Supabase de staging |

### Secrets Opcionais

| Secret | Descrição |
|--------|-----------|
| `SEMGREP_APP_TOKEN` | Token do Semgrep Cloud (para dashboard de segurança) |

---

## ⚙️ Configuração do Vercel

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Fazer login
vercel login

# 3. Linkar o projeto (gera .vercel/project.json com IDs)
vercel link

# 4. Ver os IDs necessários
cat .vercel/project.json
```

## 🌿 Estratégia de Branches

```
main      ──→ Deploy automático em PRODUÇÃO
develop   ──→ Deploy automático em STAGING
feature/* ──→ Apenas CI (sem deploy)
fix/*     ──→ Apenas CI (sem deploy)
```

## ✅ Aprovação de Deploy em Produção

Configure em `Settings → Environments → production`:
- Marque **Required reviewers** e adicione seu usuário
- Isso exige aprovação manual antes de cada deploy em produção
