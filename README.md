# Tipster Rank

Aplicacao React para ranquear tipsters por apostas cadastradas pelos proprios usuarios.

## Rodar localmente

```bash
npm install
npm run dev
```

## Firebase

Crie um projeto no Firebase, habilite Authentication com email/senha, habilite Firestore e copie `.env.example` para `.env.local` com as chaves do app web.

Cole essas mesmas variaveis na Vercel em Project Settings > Environment Variables.

Configure os e-mails administradores separados por virgula:

```text
VITE_ADMIN_EMAILS=admin@seudominio.com,outro@seudominio.com
```

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

Qualquer visitante pode ver somente o ranking. Para cadastrar apostas, o tipster precisa criar login no proprio sistema. Somente e-mails listados em `VITE_ADMIN_EMAILS` conseguem ver todas as apostas e excluir registros.

Para producao, mantenha `tips` bloqueada para nao administradores e alimente `rankings` por uma Cloud Function, rotina administrativa ou painel interno. Isso evita expor os palpites individuais no navegador dos usuarios.

Exemplo inicial de regra Firestore:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.email in ['admin@seudominio.com'];
    }

    match /tips/{tipId} {
      allow read: if isAdmin();
      allow create: if signedIn() && request.resource.data.tipsterId == request.auth.uid;
      allow update: if false;
      allow delete: if isAdmin();
    }

    match /rankings/{tipsterId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == userId);
      allow create: if signedIn() && request.auth.uid == userId;
      allow update, delete: if false;
    }
  }
}
```

Sem variaveis Firebase, o app usa `localStorage` automaticamente.
