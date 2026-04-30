import "server-only";

import { randomUUID } from "node:crypto";
import pool from "@/lib/db";
import type {
  Guide,
  GuideCreateInput,
  GuideListQuery,
  GuideUpdateInput,
} from "@/lib/guides-schema";

export type {
  Guide,
  GuideCreateInput,
  GuideListQuery,
  GuideUpdateInput,
} from "@/lib/guides-schema";
export { GUIDE_CATEGORY_OPTIONS } from "@/lib/guides-schema";

const TABLE = "portal_guides";

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id          TEXT        PRIMARY KEY,
    title       TEXT        NOT NULL,
    category    TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    author      TEXT        NOT NULL DEFAULT 'admin',
    format      TEXT        NOT NULL DEFAULT 'markdown',
    readonly    BOOLEAN     NOT NULL DEFAULT FALSE,
    view_count  INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

type Row = {
  id: string;
  title: string;
  category: string;
  content: string;
  author: string;
  format: string;
  readonly: boolean;
  view_count: number;
  created_at: Date;
  updated_at: Date;
};

function rowToGuide(row: Row): Guide {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    author: row.author,
    format: row.format === "static-html" ? "static-html" : "markdown",
    readonly: row.readonly,
    view_count: row.view_count ?? 0,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool.query(INIT_SQL).then(() => undefined).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

export async function listGuides(query?: GuideListQuery): Promise<Guide[]> {
  await ensureTable();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query?.category?.trim()) {
    values.push(query.category.trim());
    conditions.push(`category = $${values.length}`);
  }

  if (query?.search?.trim()) {
    const term = `%${query.search.trim().toLowerCase()}%`;
    values.push(term);
    const idx = values.length;
    conditions.push(
      `(LOWER(title) LIKE $${idx} OR LOWER(author) LIKE $${idx} OR LOWER(content) LIKE $${idx})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<Row>(
    `SELECT * FROM ${TABLE} ${where} ORDER BY updated_at DESC`,
    values,
  );
  return rows.map(rowToGuide);
}

export async function getGuide(id: string): Promise<Guide | undefined> {
  await ensureTable();
  const { rows } = await pool.query<Row>(
    `SELECT * FROM ${TABLE} WHERE id = $1`,
    [id],
  );
  return rows[0] ? rowToGuide(rows[0]) : undefined;
}

export async function createGuide(input: GuideCreateInput): Promise<Guide> {
  await ensureTable();
  const format = input.format ?? "markdown";
  const content = format === "static-html" ? input.content : input.content.trim();
  const { rows } = await pool.query<Row>(
    `INSERT INTO ${TABLE} (id, title, category, content, author, format, readonly, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), NOW())
     RETURNING *`,
    [
      randomUUID(),
      input.title.trim(),
      input.category.trim(),
      content,
      (input.author || "admin").trim(),
      format,
    ],
  );
  return rowToGuide(rows[0]);
}

export async function updateGuide(
  id: string,
  input: GuideUpdateInput,
): Promise<Guide | undefined> {
  await ensureTable();
  const sets: string[] = [];
  const values: unknown[] = [];

  const set = (col: string, val: unknown) => {
    values.push(val);
    sets.push(`${col} = $${values.length}`);
  };

  if (input.title !== undefined) set("title", input.title.trim());
  if (input.category !== undefined) set("category", input.category.trim());
  if (input.content !== undefined) set("content", input.content);
  if (input.author !== undefined) set("author", input.author.trim() || "admin");
  if (input.format !== undefined) set("format", input.format);

  if (sets.length === 0) return getGuide(id);

  set("updated_at", new Date());
  values.push(id);

  const { rows } = await pool.query<Row>(
    `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ? rowToGuide(rows[0]) : undefined;
}

export async function deleteGuide(id: string): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await pool.query(
    `DELETE FROM ${TABLE} WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function incrementGuideViewCount(id: string): Promise<void> {
  await ensureTable();
  await pool.query(
    `UPDATE ${TABLE} SET view_count = view_count + 1 WHERE id = $1`,
    [id],
  );
}
