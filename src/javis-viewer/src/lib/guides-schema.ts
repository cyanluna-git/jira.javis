export const GUIDE_CATEGORY_OPTIONS = [
  "General",
  "EUV Gen3/Gen3+",
  "EUV Gen2/Gen2+",
  "EUVGen4 Tumalo",
  "EUVHalo Mk1",
  "H2D",
  "Proteus",
  "HRS",
  "IT",
  "HR",
  "Finance",
] as const;

export interface Guide {
  id: string;
  title: string;
  category: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  format?: "markdown" | "static-html";
  readonly?: boolean;
  view_count?: number;
}

export interface GuideListQuery {
  category?: string;
  search?: string;
}

export interface GuideCreateInput {
  title: string;
  category: string;
  content: string;
  author: string;
  format?: "markdown" | "static-html";
}

export interface GuideUpdateInput {
  title?: string;
  category?: string;
  content?: string;
  author?: string;
  format?: "markdown" | "static-html";
}
