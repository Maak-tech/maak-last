import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
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
    // DESC composite index for the conversation list query (ORDER BY updated_at DESC).
    // Without this, the list query performs a full scan and sorts in memory.
    index("nora_conversations_user_updated_idx").on(t.userId, t.updatedAt.desc()),
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

// ── Nora Message Feedback ──────────────────────────────────────────────────────
// User ratings and flags on individual Nora AI responses.
// Used for quality monitoring, safety incident review, and model fine-tuning.
export const noraMessageFeedback = pgTable(
  "nora_message_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    messageId: text("message_id").notNull(),
    rating: integer("rating").notNull(),          // 1–5
    flag: text("flag"),                            // 'wrong' | 'harmful' | 'unhelpful' | 'helpful' | null
    reviewedByTeam: boolean("reviewed_by_team").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nora_feedback_user_idx").on(t.userId, t.createdAt),
    index("nora_feedback_conversation_idx").on(t.conversationId),
    index("nora_feedback_flag_idx").on(t.flag),
  ]
);
