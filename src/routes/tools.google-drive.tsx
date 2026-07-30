import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FolderOpen, ExternalLink, Trash2, Plus, LayoutGrid, List } from "lucide-react";

export const Route = createFileRoute("/tools/google-drive")({
  component: GoogleDrivePage,
});

const STORAGE_KEY = "google-drive-folders";
const DEFAULT_FOLDER = {
  id: "1fu3ze9OqKKruF2ujjw75KincwejaR9bL",
  name: "Pasta principal",
};

type SavedFolder = { id: string; name: string };

function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

function GoogleDrivePage() {
  const [folders, setFolders] = useState<SavedFolder[]>([DEFAULT_FOLDER]);
  const [currentId, setCurrentId] = useState<string>(DEFAULT_FOLDER.id);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedFolder[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFolders(parsed);
          setCurrentId(parsed[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  }, [folders]);

  const iframeUrl = useMemo(
    () => `https://drive.google.com/embeddedfolderview?id=${currentId}#${view}`,
    [currentId, view],
  );

  const addFolder = () => {
    const id = extractFolderId(newUrl);
    if (!id) return;
    const name = newName.trim() || `Pasta ${folders.length + 1}`;
    if (folders.some((f) => f.id === id)) {
      setCurrentId(id);
    } else {
      setFolders([...folders, { id, name }]);
      setCurrentId(id);
    }
    setNewUrl("");
    setNewName("");
  };

  const removeFolder = (id: string) => {
    const next = folders.filter((f) => f.id !== id);
    setFolders(next);
    if (currentId === id && next.length > 0) setCurrentId(next[0].id);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Google Drive
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize pastas públicas do Drive direto do painel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Grid
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4 mr-1" /> Lista
          </Button>
          <a
            href={`https://drive.google.com/drive/folders/${currentId}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir no Drive
            </Button>
          </a>
        </div>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {folders.map((f) => (
            <div key={f.id} className="flex items-center">
              <Button
                variant={currentId === f.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentId(f.id)}
                className="rounded-r-none"
              >
                {f.name}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeFolder(f.id)}
                className="rounded-l-none border-l-0 px-2"
                title="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Cole a URL ou ID da pasta do Drive"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 min-w-[240px]"
          />
          <Input
            placeholder="Nome (opcional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-48"
          />
          <Button size="sm" onClick={addFolder} disabled={!extractFolderId(newUrl)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A pasta precisa estar compartilhada como "qualquer pessoa com o link" para
          aparecer aqui. Ao clicar numa subpasta ou arquivo, abre em nova aba.
        </p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="w-full h-[calc(100vh-18rem)] border-0"
          title="Google Drive"
        />
      </Card>
    </div>
  );
}
