## Nova página: Google Drive (embed de pastas públicas)

Adicionar item "Google Drive" no menu lateral que abre uma página dentro do painel exibindo pastas públicas do Drive via iframe oficial de embed.

### Como funciona o embed do Drive
O Google oferece uma URL específica que **permite iframe** (diferente do `/drive/folders/...` normal):
```
https://drive.google.com/embeddedfolderview?id=FOLDER_ID#grid
```
- Suporta `#grid` (miniaturas) ou `#list` (lista)
- Funciona apenas com pastas compartilhadas como "qualquer pessoa com o link"
- Permite navegar em subpastas e abrir arquivos (em nova aba)

### Arquivos a criar/editar

1. **`src/routes/tools.google-drive.tsx`** (novo)
   - Página com:
     - Campo de input para colar uma URL/ID de pasta do Drive
     - Botão para alternar visualização grid/list
     - Iframe ocupando o espaço útil da página exibindo `embeddedfolderview`
     - Lista de "pastas salvas" persistidas em `localStorage` (nome + ID), com botões para alternar entre elas e remover
     - A pasta inicial será a que você enviou: `1fu3ze9OqKKruF2ujjw75KincwejaR9bL`
   - Extrai o ID automaticamente de URLs nos formatos `/folders/{id}` ou `?id={id}`
   - Mostra aviso quando a pasta não é pública (iframe falha silenciosamente — incluir nota explicativa)

2. **`src/components/app-sidebar.tsx`** (editar)
   - Adicionar item `{ title: "Google Drive", url: "/tools/google-drive", icon: FolderOpen }` na lista `tools` (importar `FolderOpen` de lucide-react)

3. **Rota auto-gerada**: `src/routeTree.gen.ts` é atualizado automaticamente pelo plugin do TanStack Router — não preciso editar manualmente.

### Detalhes técnicos
- Sem necessidade de OAuth, API keys ou backend
- Sem dependências novas
- Iframe com `className="w-full h-[calc(100vh-8rem)]"` para preencher a área
- `localStorage` key: `google-drive-folders` (array de `{ id, name }`)
