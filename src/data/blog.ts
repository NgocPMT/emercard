import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  author: string;
  coverUrl: string;
  coverAlt: string;
  body: string;
  paragraphs: string[];
};

const contentRoot = join(process.cwd(), "src/content/blog");
const coverModules = import.meta.glob("../content/blog/*/cover.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string | { src: string }>;

function parseFrontmatter(source: string) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid markdown file: missing frontmatter");
  }

  const frontmatter = Object.fromEntries(
    match[1]!
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          throw new Error(`Invalid frontmatter line: ${line}`);
        }
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        return [key, value] as const;
      }),
  ) as Record<string, string>;

  return {
    frontmatter,
    body: match[2]!.trim(),
  };
}

function splitParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+\n/g, " ").trim())
    .filter(Boolean);
}

function required(frontmatter: Record<string, string>, key: string) {
  const value = frontmatter[key];
  if (!value) {
    throw new Error(`Missing required frontmatter field: ${key}`);
  }
  return value;
}

export function getBlogPosts(): BlogPost[] {
  return readdirSync(contentRoot)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const filePath = join(contentRoot, file);
      const source = readFileSync(filePath, "utf8");
      const { frontmatter, body } = parseFrontmatter(source);
      const slug = file.replace(/\.md$/, "");
      const coverModule = coverModules[`../content/blog/${slug}/cover.jpg`];
      const coverUrl = typeof coverModule === "string" ? coverModule : coverModule?.src ?? "";
      const paragraphs = splitParagraphs(body);

      return {
        slug,
        title: required(frontmatter, "title"),
        description: required(frontmatter, "description"),
        pubDate: new Date(required(frontmatter, "pubDate")),
        author: required(frontmatter, "author"),
        coverUrl,
        coverAlt: required(frontmatter, "coverAlt"),
        body,
        paragraphs,
      } satisfies BlogPost;
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getBlogPostBySlug(slug: string) {
  return getBlogPosts().find((post) => post.slug === slug) ?? null;
}

export function getBlogPostSlugs() {
  return getBlogPosts().map((post) => post.slug);
}
