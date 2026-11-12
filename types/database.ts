// supabase/schema.sql + supabase/revize.sql ile birebir eşleşen tipler.
// Şema değişirse burayı da güncelleyin.

// pending: Kabul bekliyor · in_progress: Yapılıyor · review: Kontrol · done: Tamamlandı
export type TaskStatus = "pending" | "in_progress" | "review" | "done";
// none: Önceliksiz · low: Düşük · medium: Orta · high: Yüksek · urgent: Acil
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null; // uygulamayı en son kullandığı an (veritabanı saati)
};

export type Project = {
  id: string;
  name: string;
  url: string | null; // isteğe bağlı proje linki
  created_by: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  assigned_to: string | null; // null = "Herkes"
  created_by: string | null;
  due_date: string | null; // "YYYY-MM-DD"
  completed_at: string | null; // "Tamamlandı" yapıldığı an (veritabanı yazar)
  accepted_at: string | null;
  revision_count: number; // Kontrol → Yapılıyor (Revize Ver) sayısı
  recurring_id: string | null; // tekrarlayan görevden açıldıysa onun kaydı
  created_at: string;
  updated_at: string;
};

// Tekrarlayan görev tanımı: her sabah zamanı gelenlerden yeni görev açılır.
// supabase/tekrarlayan-gorevler.sql
// daily: her gün · weekdays: hafta içi her gün · weekly: her hafta ·
// biweekly: iki haftada bir · monthly: her ay (anchor_day: ayın kaçı)
export type RecurringFrequency = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly";

export type RecurringTask = {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  assigned_to: string | null; // null = "Herkes"
  created_by: string;
  priority: TaskPriority;
  frequency: RecurringFrequency;
  anchor_day: number | null; // sadece "monthly": ayın günü (1-31; kısa ayda son gün)
  due_after_days: number | null; // teslim tarihi: açıldıktan kaç gün sonra (null = yok)
  next_run: string; // sıradaki açılış günü "YYYY-MM-DD"
  last_run: string | null;
  is_active: boolean; // false = duraklatıldı
  created_at: string;
};

// Görev bağımlılığı: depends_on_id tamamlanmadan task_id başlatılamaz (kabul edilemez).
// supabase/gorev-bagimliligi.sql
export type TaskDependency = {
  task_id: string;
  depends_on_id: string;
  added_by: string | null;
  created_at: string;
};

// Hata kayıtları: sunucu yazar, sadece Admin okur. supabase/hata-kayitlari.sql
export type ErrorLogRow = {
  id: number;
  created_at: string;
  source: "server" | "client";
  message: string;
  digest: string | null;
  path: string | null;
  method: string | null;
  route: string | null;
  kind: string | null;
  stack: string | null;
  user_id: string | null;
  user_agent: string | null;
};

export type Comment = {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type Attachment = {
  id: string;
  task_id: string;
  file_url: string; // özel bucket'taki dosya yolu
  file_name: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
};

export type MemberRole = {
  profile_id: string;
  role_id: string;
  created_at: string;
};

// "Genel" sayfası: projeden bağımsız ekip sohbeti
export type GeneralMessage = {
  id: string;
  user_id: string | null; // gönderen
  receiver_id: string | null; // null: herkese açık; dolu: sadece gönderen ve alıcı görür
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type GeneralFile = {
  id: string;
  message_id: string;
  file_url: string; // 'general-files' bucket'ındaki dosya yolu
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

// LİNKLER listesinden kaldırılan linkler (scope: "genel" ya da görev id'si)
export type RemovedLink = {
  id: string;
  scope: string;
  url: string;
  removed_by: string | null;
  created_at: string;
};

// Göreve harcanan süre (sayaç ya da elle); ended_at boşsa sayaç çalışıyor
export type TimeEntry = {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  note: string;
  created_at: string;
};

// Uygulama içi bildirim (🔔): sunucu yazar, alıcı okur / okundu işaretler
export type AppNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: string;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
};

// Kontrol listesi (alt görev) maddesi
export type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
};

export type LabelColor =
  | "slate" | "red" | "orange" | "amber" | "green" | "teal" | "sky" | "blue" | "violet" | "pink";

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
  created_by: string | null;
  created_at: string;
};

export type TaskLabel = {
  task_id: string;
  label_id: string;
  added_by: string | null;
  added_at: string;
};

// Teslim tarihi hatırlatmaları (sadece sunucu): görev başına her tür bir kez
export type TaskReminder = {
  task_id: string;
  kind: "tomorrow" | "today" | "overdue";
  sent_at: string;
};

// Mesaj tepkileri: Genel mesajına (message_id) ya da görev yorumuna (comment_id) emoji
export type MessageReaction = {
  id: string;
  message_id: string | null;
  comment_id: string | null;
  user_id: string;
  emoji: string;
  created_at: string;
};

// Etkinlik akışı: sadece veritabanı tetikleyicileri yazar, herkes okur
export type ActivityAction =
  | "task_created"
  | "task_reassigned"
  | "task_accepted"
  | "task_submitted"
  | "task_revision"
  | "task_completed"
  | "task_deleted"
  | "comment_added"
  | "project_created";

export type ActivityLog = {
  id: number;
  actor_id: string | null;
  action: ActivityAction;
  task_id: string | null;
  project_id: string | null;
  target_id: string | null;
  title: string;
  created_at: string;
};

// Web Push abonelikleri (cihaz başına bir satır); kullanıcı sadece kendininkini görür
export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

// Uygulama ayarları (anahtar → JSON); herkes okur, sadece Admin değiştirir
export type AppSetting = {
  key: string;
  value: { [key: string]: unknown };
  updated_at: string;
};

// Kişisel yapılacaklar: sadece sahibi görür (RLS)
export type PersonalTodo = {
  id: string;
  user_id: string;
  title: string;
  category: string | null; // null = başlıksız
  is_completed: boolean;
  created_at: string;
};

// Abonelikler ve düzenli giderler: sadece sahibi görür (RLS). supabase/abonelikler.sql
export type SubscriptionCategory = "ai_saas" | "server_domain" | "telecom" | "bank_card" | "other";
export type SubscriptionPeriod = "monthly" | "yearly";
export type Currency = "TRY" | "USD" | "EUR";

export type Subscription = {
  id: string;
  user_id: string;
  category: SubscriptionCategory;
  name: string;
  provider: string | null;
  plan_name: string | null;
  service_no: string | null;
  account_email: string | null;
  period: SubscriptionPeriod | null;
  renewal_day: number | null; // aylıkta ayın kaçı; GSM'de fatura kesim günü
  renewal_date: string | null; // "YYYY-MM-DD"
  auto_renew: boolean | null;
  cancel_at_period_end: boolean;
  cancel_url: string | null;
  has_commitment: boolean | null;
  contract_start: string | null;
  contract_end: string | null;
  statement_day: number | null;
  due_day: number | null;
  current_debt: number | null;
  minimum_payment: number | null;
  amount: number | null;
  currency: Currency;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Gönderilen abonelik hatırlatmaları (sadece sunucu okur/yazar). supabase/abonelik-hatirlatma.sql
export type SubscriptionReminderRow = {
  subscription_id: string;
  kind: "due" | "contract";
  due_on: string; // "YYYY-MM-DD"
  sent_at: string;
};

// ---------------------------------------------------------------------
// Supabase istemcisine verilen şema tipi (sorgular otomatik tiplenir)
// ---------------------------------------------------------------------

type Rel<
  Name extends string,
  Column extends string,
  Target extends string,
  OneToOne extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: OneToOne;
  referencedRelation: Target;
  referencedColumns: ["id"];
};

type Table<Row, Insert, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, "id"> & Partial<Omit<Profile, "id">>,
        [Rel<"profiles_id_fkey", "id", "users", true>]
      >;
      projects: Table<
        Project,
        Pick<Project, "name"> & Partial<Omit<Project, "name">>,
        [Rel<"projects_created_by_fkey", "created_by", "profiles">]
      >;
      tasks: Table<
        Task,
        Pick<Task, "title"> & Partial<Omit<Task, "title">>,
        [
          Rel<"tasks_assigned_to_fkey", "assigned_to", "profiles">,
          Rel<"tasks_created_by_fkey", "created_by", "profiles">,
          Rel<"tasks_project_id_fkey", "project_id", "projects">,
          Rel<"tasks_recurring_id_fkey", "recurring_id", "recurring_tasks">,
        ]
      >;
      recurring_tasks: Table<
        RecurringTask,
        Pick<RecurringTask, "title" | "project_id" | "frequency" | "next_run"> &
          Partial<Omit<RecurringTask, "title" | "project_id" | "frequency" | "next_run">>,
        [
          Rel<"recurring_tasks_project_id_fkey", "project_id", "projects">,
          Rel<"recurring_tasks_assigned_to_fkey", "assigned_to", "profiles">,
          Rel<"recurring_tasks_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      task_dependencies: Table<
        TaskDependency,
        Pick<TaskDependency, "task_id" | "depends_on_id"> & Partial<Pick<TaskDependency, "added_by" | "created_at">>,
        [
          Rel<"task_dependencies_task_id_fkey", "task_id", "tasks">,
          Rel<"task_dependencies_depends_on_id_fkey", "depends_on_id", "tasks">,
          Rel<"task_dependencies_added_by_fkey", "added_by", "profiles">,
        ]
      >;
      error_log: Table<
        ErrorLogRow,
        Pick<ErrorLogRow, "source" | "message"> & Partial<Omit<ErrorLogRow, "id" | "source" | "message">>,
        [Rel<"error_log_user_id_fkey", "user_id", "profiles">]
      >;
      activity_log: Table<
        ActivityLog,
        Pick<ActivityLog, "action"> & Partial<Omit<ActivityLog, "action">>,
        [
          Rel<"activity_log_actor_id_fkey", "actor_id", "profiles">,
          Rel<"activity_log_target_id_fkey", "target_id", "profiles">,
          Rel<"activity_log_task_id_fkey", "task_id", "tasks">,
          Rel<"activity_log_project_id_fkey", "project_id", "projects">,
        ]
      >;
      task_comments: Table<
        Comment,
        Pick<Comment, "task_id" | "content"> &
          Partial<Omit<Comment, "task_id" | "content">>,
        [
          Rel<"task_comments_task_id_fkey", "task_id", "tasks">,
          Rel<"task_comments_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      task_attachments: Table<
        Attachment,
        Pick<Attachment, "task_id" | "file_url" | "file_name"> &
          Partial<Omit<Attachment, "task_id" | "file_url" | "file_name">>,
        [
          Rel<"task_attachments_task_id_fkey", "task_id", "tasks">,
          Rel<"task_attachments_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      roles: Table<
        Role,
        Pick<Role, "name"> & Partial<Omit<Role, "name">>,
        [Rel<"roles_created_by_fkey", "created_by", "profiles">]
      >;
      member_roles: Table<
        MemberRole,
        Pick<MemberRole, "profile_id" | "role_id"> &
          Partial<Pick<MemberRole, "created_at">>,
        [
          Rel<"member_roles_profile_id_fkey", "profile_id", "profiles">,
          Rel<"member_roles_role_id_fkey", "role_id", "roles">,
        ]
      >;
      time_entries: Table<
        TimeEntry,
        Pick<TimeEntry, "task_id" | "started_at"> & Partial<Omit<TimeEntry, "task_id" | "started_at">>,
        [
          Rel<"time_entries_task_id_fkey", "task_id", "tasks">,
          Rel<"time_entries_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      notifications: Table<
        AppNotification,
        Pick<AppNotification, "recipient_id" | "title"> &
          Partial<Omit<AppNotification, "recipient_id" | "title">>,
        [
          Rel<"notifications_recipient_id_fkey", "recipient_id", "profiles">,
          Rel<"notifications_actor_id_fkey", "actor_id", "profiles">,
        ]
      >;
      task_checklist_items: Table<
        ChecklistItem,
        Pick<ChecklistItem, "task_id" | "title"> & Partial<Omit<ChecklistItem, "task_id" | "title">>,
        [
          Rel<"task_checklist_items_task_id_fkey", "task_id", "tasks">,
          Rel<"task_checklist_items_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      labels: Table<
        Label,
        Pick<Label, "name"> & Partial<Omit<Label, "name">>,
        [Rel<"labels_created_by_fkey", "created_by", "profiles">]
      >;
      task_labels: Table<
        TaskLabel,
        Pick<TaskLabel, "task_id" | "label_id"> & Partial<Pick<TaskLabel, "added_by" | "added_at">>,
        [
          Rel<"task_labels_task_id_fkey", "task_id", "tasks">,
          Rel<"task_labels_label_id_fkey", "label_id", "labels">,
        ]
      >;
      task_reminders: Table<
        TaskReminder,
        Pick<TaskReminder, "task_id" | "kind"> & Partial<Pick<TaskReminder, "sent_at">>,
        [Rel<"task_reminders_task_id_fkey", "task_id", "tasks">]
      >;
      message_reactions: Table<
        MessageReaction,
        Pick<MessageReaction, "emoji"> & Partial<Omit<MessageReaction, "emoji">>,
        [
          Rel<"message_reactions_message_id_fkey", "message_id", "general_messages">,
          Rel<"message_reactions_comment_id_fkey", "comment_id", "task_comments">,
          Rel<"message_reactions_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      general_messages: Table<
        GeneralMessage,
        Partial<GeneralMessage>,
        [
          Rel<"general_messages_user_id_fkey", "user_id", "profiles">,
          Rel<"general_messages_receiver_id_fkey", "receiver_id", "profiles">,
        ]
      >;
      general_files: Table<
        GeneralFile,
        Pick<GeneralFile, "message_id" | "file_url" | "file_name"> &
          Partial<Omit<GeneralFile, "message_id" | "file_url" | "file_name">>,
        [
          Rel<"general_files_message_id_fkey", "message_id", "general_messages">,
          Rel<"general_files_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      push_subscriptions: Table<
        PushSubscriptionRow,
        Pick<PushSubscriptionRow, "endpoint" | "p256dh" | "auth"> &
          Partial<Pick<PushSubscriptionRow, "id" | "user_id" | "created_at">>
      >;
      app_settings: Table<AppSetting, Pick<AppSetting, "key"> & Partial<Omit<AppSetting, "key">>>;
      personal_todos: Table<
        PersonalTodo,
        Pick<PersonalTodo, "title"> & Partial<Omit<PersonalTodo, "title">>
      >;
      subscriptions: Table<
        Subscription,
        Pick<Subscription, "category" | "name"> & Partial<Omit<Subscription, "category" | "name">>
      >;
      subscription_reminders: Table<
        SubscriptionReminderRow,
        Pick<SubscriptionReminderRow, "subscription_id" | "kind" | "due_on"> &
          Partial<Pick<SubscriptionReminderRow, "sent_at">>,
        [Rel<"subscription_reminders_subscription_id_fkey", "subscription_id", "subscriptions">]
      >;
      removed_links: Table<
        RemovedLink,
        Pick<RemovedLink, "scope" | "url"> & Partial<Omit<RemovedLink, "scope" | "url">>,
        [Rel<"removed_links_removed_by_fkey", "removed_by", "profiles">]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
