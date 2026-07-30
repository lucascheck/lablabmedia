import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Plus, Trash2, GripVertical, Calendar, Flag, X, Link as LinkIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/tools/tarefas")({
  component: TarefasPage,
  head: () => ({
    meta: [
      { title: "Tarefas — LabMedia" },
      { name: "description", content: "Quadro Kanban de tarefas com arrastar e soltar." },
    ],
  }),
});

type TaskColumn = {
  id: string;
  title: string;
  position: number;
};

type TaskCard = {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  due_date: string | null;
  priority: "baixa" | "normal" | "alta" | "urgente";
  link: string | null;
  assigned_to: string | null;
};

type AssignableUser = { id: string; email: string };

const PRIORITIES: TaskCard["priority"][] = ["baixa", "normal", "alta", "urgente"];

const PRIORITY_STYLES: Record<TaskCard["priority"], string> = {
  baixa: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20",
  alta: "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/20",
  urgente: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20",
};

function TarefasPage() {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const isAdmin = !!profile?.isAdmin;
  const navigate = useNavigate();

  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [fetching, setFetching] = useState(true);
  const [users, setUsers] = useState<AssignableUser[]>([]);

  const usersById = useMemo(() => {
    const m: Record<string, AssignableUser> = {};
    users.forEach((u) => (m[u.id] = u));
    return m;
  }, [users]);

  const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskColumn | null>(null);
  const [editingCard, setEditingCard] = useState<TaskCard | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<
    { type: "column" | "card"; id: string; title?: string } | null
  >(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !profile) return;
    void loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const loadBoard = async () => {
    if (!user) return;
    setFetching(true);

    // Admins share a single board: load all data owned by any admin.
    let adminIds: string[] = [];
    if (isAdmin) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      adminIds = (roles ?? []).map((r) => r.user_id as string);
      if (!adminIds.includes(user.id)) adminIds.push(user.id);
    }

    const colsQuery = supabase
      .from("task_columns")
      .select("id,title,position")
      .order("position", { ascending: true });
    const cardsQuery = supabase
      .from("task_cards")
      .select("id,column_id,title,description,position,due_date,priority,link,assigned_to")
      .order("position", { ascending: true });

    const [colsRes, cardsRes] = await Promise.all([
      isAdmin ? colsQuery.in("user_id", adminIds) : colsQuery.eq("user_id", user.id),
      isAdmin ? cardsQuery.in("user_id", adminIds) : cardsQuery.eq("user_id", user.id),
    ]);

    let cols = (colsRes.data ?? []) as TaskColumn[];

    if (cols.length === 0) {
      const defaults = [
        { user_id: user.id, title: "A fazer", position: 0 },
        { user_id: user.id, title: "Em progresso", position: 1 },
        { user_id: user.id, title: "Concluído", position: 2 },
      ];
      const { data: created } = await supabase
        .from("task_columns")
        .insert(defaults)
        .select("id,title,position");
      cols = (created ?? []) as TaskColumn[];
      cols.sort((a, b) => a.position - b.position);
    }

    setColumns(cols);
    setCards(((cardsRes.data ?? []) as TaskCard[]).slice().sort((a, b) => a.position - b.position));

    // Load list of assignable users (all profiles)
    const { data: profs } = await supabase.from("profiles").select("id,email");
    setUsers(((profs ?? []) as AssignableUser[]).sort((a, b) => a.email.localeCompare(b.email)));

    setFetching(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardsByColumn = useMemo(() => {
    const map: Record<string, TaskCard[]> = {};
    columns.forEach((c) => (map[c.id] = []));
    cards.forEach((c) => {
      if (!map[c.column_id]) map[c.column_id] = [];
      map[c.column_id].push(c);
    });
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => a.position - b.position),
    );
    return map;
  }, [columns, cards]);

  const findCard = (id: string) => cards.find((c) => c.id === id) ?? null;
  const isColumn = (id: string) => columns.some((c) => c.id === id);

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const type = e.active.data.current?.type;
    if (type === "column") {
      const col = columns.find((c) => c.id === id) ?? null;
      setActiveColumn(col);
    } else {
      const c = findCard(id);
      setActiveCard(c);
    }
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    if (active.data.current?.type !== "card") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const activeCardData = findCard(activeId);
    if (!activeCardData) return;

    let overColumnId: string | null = null;
    if (isColumn(overId)) {
      overColumnId = overId;
    } else {
      const overCard = findCard(overId);
      if (overCard) overColumnId = overCard.column_id;
    }
    if (!overColumnId) return;
    if (activeCardData.column_id === overColumnId) return;

    setCards((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, column_id: overColumnId! } : c)),
    );
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const wasColumn = !!activeColumn;
    setActiveCard(null);
    setActiveColumn(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Column reordering
    if (wasColumn || active.data.current?.type === "column") {
      if (!isColumn(overId) || activeId === overId) return;
      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({
        ...c,
        position: i,
      }));
      setColumns(reordered);
      const results = await Promise.all(
        reordered.map((c) =>
          supabase.from("task_columns").update({ position: c.position }).eq("id", c.id),
        ),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) toast.error(err.message);
      return;
    }

    // Card move / reorder
    const activeCardData = findCard(activeId);
    if (!activeCardData) return;

    let targetColumnId = activeCardData.column_id;
    let targetIndex: number;

    if (isColumn(overId)) {
      targetColumnId = overId;
      targetIndex = cardsByColumn[overId]?.length ?? 0;
    } else {
      const overCard = findCard(overId);
      if (!overCard) return;
      targetColumnId = overCard.column_id;
      const list = cardsByColumn[targetColumnId] ?? [];
      targetIndex = list.findIndex((c) => c.id === overId);
      if (targetIndex < 0) targetIndex = list.length;
    }

    const newCards = cards.map((c) =>
      c.id === activeId ? { ...c, column_id: targetColumnId } : c,
    );
    const columnList = newCards
      .filter((c) => c.column_id === targetColumnId)
      .sort((a, b) => a.position - b.position);
    const oldIndex = columnList.findIndex((c) => c.id === activeId);
    const reordered = arrayMove(columnList, oldIndex, targetIndex);
    const updatedPositions = reordered.map((c, i) => ({ ...c, position: i }));

    const merged = newCards.map((c) => {
      const u = updatedPositions.find((x) => x.id === c.id);
      return u ?? c;
    });
    setCards(merged);

    const updates = updatedPositions.map((c) =>
      supabase
        .from("task_cards")
        .update({ column_id: c.column_id, position: c.position })
        .eq("id", c.id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
  };

  const addColumn = async () => {
    if (!user) return;
    const position = columns.length;
    const { data, error } = await supabase
      .from("task_columns")
      .insert({ user_id: user.id, title: "Nova coluna", position })
      .select("id,title,position")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao criar coluna");
      return;
    }
    setColumns((prev) => [...prev, data as TaskColumn]);
  };

  const renameColumn = async (id: string, title: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const { error } = await supabase.from("task_columns").update({ title }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteColumn = async (id: string) => {
    const col = columns.find((c) => c.id === id);
    setConfirmDelete({ type: "column", id, title: col?.title });
  };

  const doDeleteColumn = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    const { error } = await supabase.from("task_columns").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      setConfirmDelete(null);
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setCards((prev) => prev.filter((c) => c.column_id !== id));
    setConfirmDelete(null);
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setEditingCard(null);
    const { error } = await supabase.from("task_cards").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const addCard = async (columnId: string) => {
    if (!user) return;
    const position = (cardsByColumn[columnId]?.length ?? 0);
    const { data, error } = await supabase
      .from("task_cards")
      .insert({
        user_id: user.id,
        column_id: columnId,
        title: "Nova tarefa",
        position,
      })
      .select("id,column_id,title,description,position,due_date,priority,link,assigned_to")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao criar card");
      return;
    }
    setCards((prev) => [...prev, data as TaskCard]);
    setEditingCard(data as TaskCard);
  };

  const saveCard = async (card: TaskCard) => {
    const previous = cards.find((c) => c.id === card.id);
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    const { error } = await supabase
      .from("task_cards")
      .update({
        title: card.title,
        description: card.description,
        due_date: card.due_date,
        priority: card.priority,
        link: card.link,
        assigned_to: card.assigned_to,
      })
      .eq("id", card.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Notify the newly assigned user (only when the assignee actually changed)
    if (
      user &&
      card.assigned_to &&
      card.assigned_to !== user.id &&
      card.assigned_to !== previous?.assigned_to
    ) {
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: card.assigned_to,
        actor_id: user.id,
        type: "task_assigned",
        title: "Você foi marcado em uma tarefa",
        body: card.title,
        link: "/tools/tarefas",
        related_id: card.id,
      });
      if (notifErr) {
        toast.error("Card salvo, mas falha ao notificar: " + notifErr.message);
      } else {
        toast.success("Usuário notificado");
      }
    }
  };


  if (loading || !user || fetching) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="px-6 py-6 border-b">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organize seu fluxo em colunas. Arraste e solte para mover.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto p-6">
          <div className="flex gap-4 items-start min-h-[60vh]">
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  cards={cardsByColumn[col.id] ?? []}
                  users={usersById}
                  onRename={renameColumn}
                  onDelete={deleteColumn}
                  onAddCard={addCard}
                  onEditCard={setEditingCard}
                />
              ))}
            </SortableContext>

            <Button
              variant="outline"
              onClick={addColumn}
              className="h-12 shrink-0 border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" /> Nova coluna
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? <CardView card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {editingCard && (
        <CardEditor
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={saveCard}
          onRequestDelete={(id) =>
            setConfirmDelete({ type: "card", id, title: editingCard.title })
          }
        />
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDelete?.type === "column"
              ? `Deseja excluir a coluna "${confirmDelete.title ?? ""}" e todos os cards dela?`
              : `Deseja excluir a tarefa "${confirmDelete?.title ?? ""}"?`}
          </p>
          <DialogFooter className="gap-2 sm:gap-2 flex-row justify-end sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete?.type === "column") {
                  void doDeleteColumn();
                } else if (confirmDelete) {
                  void deleteCard(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColumnView({
  column,
  cards,
  users,
  onRename,
  onDelete,
  onAddCard,
  onEditCard,
}: {
  column: TaskColumn;
  cards: TaskCard[];
  users: Record<string, AssignableUser>;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAddCard: (columnId: string) => void;
  onEditCard: (card: TaskCard) => void;
}) {
  const sortable = useSortableColumn(column.id);
  const { setNodeRef, isOver, attributes, listeners, transform, transition, isDragging } = sortable;
  const [title, setTitle] = useState(column.title);

  useEffect(() => setTitle(column.title), [column.title]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-72 shrink-0 rounded-xl border bg-muted/30 flex flex-col max-h-[calc(100vh-180px)] transition-colors ${
        isOver ? "border-primary/50 bg-muted/60" : ""
      }`}
    >
      <div className="flex items-center gap-1 p-2 border-b">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Arrastar coluna"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== column.title && onRename(column.id, title.trim() || "Sem título")}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 font-semibold border-transparent bg-transparent focus-visible:bg-background"
        />
        <span className="text-xs text-muted-foreground tabular-nums px-1">{cards.length}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(column.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onClick={() => onEditCard(card)}
              assigneeEmail={card.assigned_to ? users[card.assigned_to]?.email : undefined}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
            Solte cards aqui
          </div>
        )}
      </div>

      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar card
        </Button>
      </div>
    </div>
  );
}

function useSortableColumn(id: string) {
  const sortable = useSortable({ id, data: { type: "column" } });
  return sortable;
}

function SortableCard({
  card,
  onClick,
  assigneeEmail,
}: {
  card: TaskCard;
  onClick: () => void;
  assigneeEmail?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardView card={card} assigneeEmail={assigneeEmail} />
    </div>
  );
}


function CardView({ card, dragging = false, assigneeEmail }: { card: TaskCard; dragging?: boolean; assigneeEmail?: string }) {
  const due = card.due_date ? new Date(card.due_date) : null;
  return (
    <Card
      className={`p-3 cursor-pointer hover:border-primary/50 transition-colors ${
        dragging ? "shadow-lg ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="font-medium text-sm leading-snug break-words">{card.title}</div>
      {card.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
          {card.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLES[card.priority]}`}
        >
          <Flag className="h-2.5 w-2.5" />
          {card.priority}
        </span>
        {due && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {due.toLocaleDateString("pt-BR")}
          </span>
        )}
        {card.link && (
          <a
            href={card.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline max-w-[160px] truncate"
            title={card.link}
          >
            <LinkIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">link</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        )}
      </div>
    </Card>
  );
}

function CardEditor({
  card,
  onClose,
  onSave,
  onRequestDelete,
}: {
  card: TaskCard;
  onClose: () => void;
  onSave: (card: TaskCard) => void;
  onRequestDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<TaskCard>(card);

  useEffect(() => setDraft(card), [card.id]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="mt-1 min-h-[120px]"
              placeholder="Notas, checklist, contexto..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select
                value={draft.priority}
                onValueChange={(v) =>
                  setDraft({ ...draft, priority: v as TaskCard["priority"] })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" /> Link
            </label>
            <Input
              type="url"
              value={draft.link ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, link: e.target.value ? e.target.value : null })
              }
              placeholder="https://..."
              className="mt-1"
            />
            {draft.link && (
              <a
                href={draft.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="h-3 w-3" /> Abrir link
              </a>
            )}
          </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data de entrega</label>
              <Input
                type="date"
                value={draft.due_date ? draft.due_date.slice(0, 10) : ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    due_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onRequestDelete(card.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
