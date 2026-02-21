Leia o arquivo CLAUDE.md na raiz do projeto.

Verifique o status atual:

1. Leia o checklist no CLAUDE.md
2. Verifique quais arquivos existem: `find src/ -type f 2>/dev/null`
3. Verifique tabelas no banco: `psql postgresql://connect_dev:61EIOs7zD8K5N@localhost:5432/connect_schappo -c "\dt atd.*"`
4. Verifique se dev server funciona: `curl -s http://localhost:3000/api/health 2>/dev/null`
5. Mostre resumo:

```
✅ Feito:
⏳ Próximo:
❌ Pendente:
```

6. Sugira próximo passo. Responda em português.
