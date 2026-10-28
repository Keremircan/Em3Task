"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  Check,
  CircleAlert,
  Ellipsis,
  FolderKanban,
  ListTodo,
  Pencil,
  Plus,
  Trash,
  X,
} from "lucide-react";
import type { PersonalTodo } from "@/types/database";
import {
  createPersonalTodo,
  deletePersonalCategory,
  deletePersonalTodo,
  renamePersonalCategory,
  togglePersonalTodo,
  updatePersonalTodo,
} from "@/actions/personal-todo";
import { cleanCategory, cleanTitle, MAX_TODO_CATEGORY, MAX_TODO_TITLE } from "@/lib/personal-todo";
import { card, field, primaryButton } from "@/components/ui/styles";
import { SelectField } from "@/components/ui/select-field";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { safe } from "@/lib/safe-action";

type Todo = Pick<PersonalTodo, "id" | "title" | "category" | "is_completed" | "created_at">;

type Op =
  | { type: "add"; todo: Todo }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "edit"; id: string; title: string }
  | { type: "remove"; id: string }
  | { type: "renameGroup"; from: string | null; to: string }
  | { type: "removeGroup"; category: string | null };

function reduce(list: Todo[], op: Op): Todo[] {
  switch (op.type) {
    case "add":
      return [...list, op.todo];
    case "toggle":
      return list.map((t) => (t.id === op.id ? { ...t, is_completed: op.done } : t));
    case "edit":
      return list.map((t) => (t.id === op.id ? { ...t, title: op.title } : t));
    case "remove":
      return list.filter((t) => t.id !== op.id);
    case "renameGroup":
      return list.map((t) => (t.category === op.from ? { ...t, category: op.to } : t));
    case "removeGroup":
      return list.filter((t) => t.category !== op.category);
  }
}

const NONE = "__none__"; // seçicide "Başlıksız"
const NEW = "__new__"; // seçicide "Yeni başlık…"
const NONE_LABEL = "Başlıksız";

type Run = (op: Op, action: () => Promise<{ error: string | null }>) => void;

// Kişisel yapılacaklar listesi. Her işlem ekrana hemen yansır (useOptimistic),
// kayıt arka planda yapılır; hata olursa ekran eski haline döner ve uyarı çıkar.
export function TodoBoard({ todos, projectNames }: { todos: Todo[]; projectNames: string[] }) {
  const [list, apply] = useOptimistic(todos, reduce);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run: Run = (op, action) => {
    setError(null);
    startTransition(async () => {
      apply(op);
      const result = await safe(action());
      if (result.error) setError(result.error);
    });
  };

  function add(title: string, category: string | null) {
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      category,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    run({ type: "add", todo }, () => createPersonalTodo(todo.id, title, category));
  }

  // Başlıklar: ilk maddesi en eski olan önce; başlıksızlar en üstte
  const groups = new Map<string | null, Todo[]>();
  for (const todo of [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const items = groups.get(todo.category) ?? [];
    items.push(todo);
    groups.set(todo.category, items);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === null ? -1 : b === null ? 1 : 0,
  );
  const customNames = [...groups.keys()].filter(
    (c): c is string => c !== null && !projectNames.includes(c),
  );

  return (
    <>
      <AddBar onAdd={add} customNames={customNames} projectNames={projectNames} />

      {ordered.length === 0 ? (
        <div className={`${card} mt-4 flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <ListTodo className="size-8 text-slate-300" />
          <p className="font-semibold text-slate-700">Listeniz boş</p>
          <p className="max-w-sm text-sm text-slate-500">
            Yukarıdan bir madde ekleyin. Maddeleri kendi başlıklarınız ya da proje adları altında
            toplayabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {ordered.map(([category, items]) => (
            <TodoGroup
              key={category ?? NONE}
              category={category}
              items={items}
              isProject={category !== null && projectNames.includes(category)}
              run={run}
              onAdd={(title) => add(title, category)}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm text-rose-700 shadow-lg lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">İşlem geri alındı: {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Uyarıyı kapat"
            className="rounded p-0.5 text-rose-500 hover:bg-rose-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

// Sayfa başındaki hızlı ekleme: madde metni + başlık seçici (başlıksız, kendi
// başlıkları, projeler ya da yeni başlık)
function AddBar({
  onAdd,
  customNames,
  projectNames,
}: {
  onAdd: (title: string, category: string | null) => void;
  customNames: string[];
  projectNames: string[];
}) {
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState(NONE);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const category = choice === NONE ? null : choice === NEW ? cleanCategory(newName) : choice;
  const canAdd = cleanTitle(title) !== "" && (choice !== NEW || category !== null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canAdd) return;
        onAdd(cleanTitle(title), category);
        setTitle("");
        // Yeni başlık bir kez yazıldıktan sonra listede seçili kalsın
        if (choice === NEW && category) {
          setChoice(category);
          setNewName("");
        }
        inputRef.current?.focus();
      }}
      className={`${card} flex flex-col gap-2.5 p-3 sm:p-4 lg:flex-row lg:items-end`}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="todo-title" className="mb-1 block text-xs font-semibold text-slate-600">
          Yapılacak
        </label>
        <input
          ref={inputRef}
          id="todo-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TODO_TITLE}
          placeholder="Örn. Sunum taslağını bitir"
          autoComplete="off"
          className={`${field} mt-0 h-10`}
        />
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <div className="sm:w-52">
          <label htmlFor="todo-category" className="mb-1 block text-xs font-semibold text-slate-600">
            Başlık
          </label>
          <SelectField
            id="todo-category"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="mt-0"
          >
            <option value={NONE}>{NONE_LABEL}</option>
            {customNames.length > 0 && (
              <optgroup label="Başlıklarım">
                {customNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
            {projectNames.length > 0 && (
              <optgroup label="Projeler">
                {projectNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={NEW}>+ Yeni başlık…</option>
          </SelectField>
        </div>

        {choice === NEW && (
          <div className="sm:w-48">
            <label htmlFor="todo-new-category" className="mb-1 block text-xs font-semibold text-slate-600">
              Yeni başlık adı
            </label>
            <input
              id="todo-new-category"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={MAX_TODO_CATEGORY}
              placeholder="Örn. Okunacaklar"
              autoFocus
              autoComplete="off"
              className={`${field} mt-0 h-10`}
            />
          </div>
        )}

        <button type="submit" disabled={!canAdd} className={`${primaryButton} h-10`}>
          <Plus className="size-4" strokeWidth={2.4} /> Ekle
        </button>
      </div>
    </form>
  );
}

function TodoGroup({
  category,
  items,
  isProject,
  run,
  onAdd,
}: {
  category: string | null;
  items: Todo[];
  isProject: boolean;
  run: Run;
  onAdd: (title: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState("");
  const doneCount = items.filter((t) => t.is_completed).length;
  // Bitmemişler üstte, tamamlananlar altta
  const sorted = [...items.filter((t) => !t.is_completed), ...items.filter((t) => t.is_completed)];
  const label = category ?? NONE_LABEL;

  return (
    <section className={`${card} overflow-hidden`}>
      <header className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
        {isProject ? (
          <FolderKanban className="size-4 shrink-0 text-teal-600" />
        ) : (
          <ListTodo className="size-4 shrink-0 text-slate-400" />
        )}
        {renaming ? (
          <RenameInput
            initial={category ?? ""}
            onCancel={() => setRenaming(false)}
            onSave={(to) => {
              setRenaming(false);
              if (to === category) return;
              run({ type: "renameGroup", from: category, to }, () =>
                renamePersonalCategory(category, to),
              );
            }}
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{label}</h2>
        )}
        <span className="shrink-0 text-xs font-medium text-slate-400">
          {doneCount}/{items.length}
        </span>
        <Menu
          label={`${label} seçenekleri`}
          trigger={<Ellipsis className="size-4" />}
          triggerClassName="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          items={[
            {
              label: category === null ? "Başlık ver" : "Yeniden adlandır",
              icon: <Pencil className="size-4" />,
              onSelect: () => setRenaming(true),
            },
            {
              label: "Başlığı sil",
              icon: <Trash className="size-4" />,
              danger: true,
              onSelect: () => setDeleting(true),
            },
          ]}
        />
      </header>

      <ul className="divide-y divide-slate-100">
        {sorted.map((todo) => (
          <TodoItem key={todo.id} todo={todo} run={run} />
        ))}
      </ul>

      {/* Bu başlığa hızlı madde ekleme */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const title = cleanTitle(draft);
          if (!title) return;
          onAdd(title);
          setDraft("");
        }}
        className="flex items-center gap-2 border-t border-slate-100 px-3.5 py-1.5"
      >
        <Plus className="size-4 shrink-0 text-slate-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TODO_TITLE}
          placeholder="Madde ekle…"
          aria-label={`${label} başlığına madde ekle`}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </form>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Başlığı sil"
        message={`"${label}" başlığı ve altındaki ${items.length} madde silinecek.`}
        confirmLabel="Başlığı sil"
        onConfirm={async () => {
          run({ type: "removeGroup", category }, () => deletePersonalCategory(category));
          return { error: null };
        }}
      />
    </section>
  );
}

function TodoItem({ todo, run }: { todo: Todo; run: Run }) {
  const [editing, setEditing] = useState(false);
  const done = todo.is_completed;

  return (
    <li className="group flex items-start gap-2.5 px-3.5 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
        onClick={() =>
          run({ type: "toggle", id: todo.id, done: !done }, () =>
            togglePersonalTodo(todo.id, !done),
          )
        }
        className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition ${
          done
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-slate-300 bg-white hover:border-teal-500"
        }`}
      >
        {done && <Check className="size-3" strokeWidth={3.2} />}
      </button>

      {editing ? (
        <RenameInput
          initial={todo.title}
          maxLength={MAX_TODO_TITLE}
          onCancel={() => setEditing(false)}
          onSave={(title) => {
            setEditing(false);
            if (title === todo.title) return;
            run({ type: "edit", id: todo.id, title }, () => updatePersonalTodo(todo.id, title));
          }}
          clean={cleanTitle}
        />
      ) : (
        <p
          onDoubleClick={() => setEditing(true)}
          className={`min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere] ${
            done ? "text-slate-400 line-through decoration-slate-400" : "text-slate-800"
          }`}
        >
          {todo.title}
        </p>
      )}

      {!editing && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Maddeyi düzenle"
            title="Düzenle"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              run({ type: "remove", id: todo.id }, () => deletePersonalTodo(todo.id))
            }
            aria-label="Maddeyi sil"
            title="Sil"
            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash className="size-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

// Satır içi düzenleme kutusu: Enter kaydeder, Esc vazgeçer, dışarı tıklayınca kaydeder
function RenameInput({
  initial,
  onSave,
  onCancel,
  maxLength = MAX_TODO_CATEGORY,
  clean = (v: string) => cleanCategory(v) ?? "",
}: {
  initial: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  maxLength?: number;
  clean?: (value: string) => string;
}) {
  const [value, setValue] = useState(initial);
  const cancelled = useRef(false);

  function save() {
    if (cancelled.current) return;
    cancelled.current = true; // Enter + ardından gelen blur iki kez kaydetmesin
    const cleaned = clean(value);
    if (cleaned) onSave(cleaned);
    else onCancel();
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") {
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={save}
      maxLength={maxLength}
      autoFocus
      className="h-7 min-w-0 flex-1 rounded-md border border-teal-400 bg-white px-2 text-sm text-slate-900 ring-3 ring-teal-500/15 outline-none"
    />
  );
}
