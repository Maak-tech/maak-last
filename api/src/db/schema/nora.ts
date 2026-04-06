import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Nora Conversations ─────────────────────────────────────────────────────────

export const noraConversations = pgTable(
  "nora_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    messages: jsonb("messages").$type<
      Array<{
        role: "user" | "assistant" | "system";
        content: string;
        timestamp: string;
      }>
    >(),
    title: text("title").default("New Chat"),
    vhiVersionAtStart: integer("vhi_version_at_start"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("nora_conversations_user_idx").on(t.userId),
    index("nora_conversations_user_updated_at_idx").on(t.userId, t.updatedAt),
  ]
);

// ── Nora Messages (post-MVP migration target) ──────────────────────────────────
// noraConversations stores all messages as a single JSONB blob — this is fine at
// small scale but causes full-row rewrites as conversation history grows.
// noraMessages is the normalized form: one row per message.
// Migration plan: backfill from noraConversations, then switch reads to this table.
export const noraMessages = pgTable(
  "nora_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("nora_messages_conversation_idx").on(t.conversationId, t.createdAt),
    index("nora_messages_user_idx").on(t.userId, t.createdAt),
  ]
);
