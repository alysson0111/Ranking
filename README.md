# Tipster Rank

Aplicacao React para ranquear tipsters por apostas cadastradas pelos proprios usuarios.

## Rodar localmente

```bash
npm install
npm run dev
```

## Firebase

Crie um projeto no Firebase, habilite Authentication com email/senha, habilite Firestore e copie `.env.example` para `.env.local` com as chaves do app web.

Cole essas mesmas variaveis na Vercel em Project Settings > Environment Variables. Nao salve senha nem lista de administradores em variaveis publicas do Vite.

Para liberar um administrador em producao, marque esse usuario com custom claim no Firebase Auth:

```text
admin = true
```

Senha de usuario nao deve ser salva no Firestore. O app usa Firebase Authentication para guardar e validar senhas. No cadastro, a senha precisa ter no minimo 8 caracteres, letra maiuscula, letra minuscula e numero. No console do Firebase, habilite tambem uma politica de senha forte em Authentication > Settings > Password policy.

Colecoes usadas no Firestore:

```text
tips
rankings
users
```

Campos principais de `tips`, visivel apenas para administrador:

```text
tipsterId, tipsterName, market, event, pick, odd, stake, result, profit, clv, placedAt
```

Campos principais de `rankings`, visivel para qualquer visitante:

```text
name, market, score, roi, profit, tips, hitRate, clv, category
```

Para filtrar por mes ou periodo no ranking publico com Firebase, gere documentos agregados por periodo em `rankings`, sem expor a colecao privada `tips`. No modo local e para administrador, o app calcula o periodo diretamente pelas apostas.

Campos principais de `users`, criado no cadastro do tipster:

```text
uid, name, nick, phone, email, createdAt, createdAtIso, role
```

O usuario nao tem tela de edicao desses dados no app.

Qualquer visitante pode ver somente o ranking. Para cadastrar apostas, o tipster precisa criar login no proprio sistema. Somente usuarios com custom claim `admin=true` conseguem ver todas as apostas e excluir registros.

Para producao, mantenha `tips` bloqueada para nao administradores e alimente `rankings` por uma Cloud Function, rotina administrativa ou painel interno. Isso evita expor os palpites individuais no navegador dos usuarios.

Regras Firestore seguras:

```text
firebase deploy --only firestore:rules
```

Antes de publicar, marque o usuario administrador no Firebase Auth com custom claim `admin=true`.

Sem variaveis Firebase, o app usa `localStorage` automaticamente.
