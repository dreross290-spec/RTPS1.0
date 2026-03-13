import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { taxReturns } from "./tax-returns";

export const intakeDocuments = pgTable("intake_documents", {
  documentId: uuid("document_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull().references(() => taxReturns.returnId),
  documentType: text("document_type").notNull(), // w2, 1099, k1, receipt, etc.
  storageKey: text("storage_key").notNull(),
  parsedData: jsonb("parsed_data").$type<Record<string, unknown>>().default({}),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviewAnswers = pgTable("interview_answers", {
  answerId: uuid("answer_id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull().references(() => taxReturns.returnId),
  section: text("section").notNull(),
  questionKey: text("question_key").notNull(),
  answer: jsonb("answer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
