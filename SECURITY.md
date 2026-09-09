# Política de Segurança

## Versões Suportadas

| Versão | Suporte de Segurança |
|--------|---------------------|
| `main` | ✅ Ativo             |
| `develop` | ✅ Ativo (staging) |
| Versões antigas | ❌ Não suportado |

## Reportando uma Vulnerabilidade

**NÃO abra uma issue pública** para reportar vulnerabilidades de segurança.

### Como Reportar

1. **E-mail privado:** Envie um e-mail para o maintainer do projeto descrevendo:
   - Tipo de vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestão de correção (se houver)

2. **GitHub Security Advisories:** Use a aba [Security → Report a vulnerability](../../security/advisories/new) do repositório para reportar de forma privada.

### O Que Esperar

- **Confirmação:** Você receberá uma resposta em até **48 horas**
- **Atualização:** Atualizações sobre o progresso em até **7 dias**
- **Resolução:** Vulnerabilidades críticas serão priorizadas e corrigidas em até **30 dias**
- **Crédito:** Reporters serão creditados no changelog (se desejarem)

## Escopo

### In Scope (Relatáveis)
- Vazamento de credenciais ou dados
- Autenticação/autorização incorreta
- Exposição de APIs ou endpoints
- Injeção de código (XSS, SQL Injection)
- Escalação de privilégios

### Out of Scope (Não relatáveis aqui)
- Vulnerabilidades em dependências de terceiros (reporte ao repositório original)
- Ataques que exigem acesso físico ao dispositivo
- Issues de usabilidade

## Práticas de Segurança do Projeto

- ✅ Secrets gerenciados via GitHub Secrets e Supabase Vault
- ✅ Assinatura de uploads Cloudinary feita exclusivamente no servidor (Edge Function)
- ✅ Scan automático de secrets com TruffleHog a cada push
- ✅ Auditoria semanal de dependências com npm audit
- ✅ SAST com Semgrep
- ✅ Rotas protegidas por autenticação e controle de role
- ✅ Content Security Policy no frontend
