import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { refractor } from "refractor/lib/core";
import tsx from "refractor/lang/tsx.js";
import typescript from "refractor/lang/typescript.js";
import javascript from "refractor/lang/javascript.js";
import jsx from "refractor/lang/jsx.js";
import json from "refractor/lang/json.js";
import python from "refractor/lang/python.js";
import bash from "refractor/lang/bash.js";
import diff from "refractor/lang/diff.js";
import markup from "refractor/lang/markup.js";
import markdown from "refractor/lang/markdown.js";
import cpp from "refractor/lang/cpp.js";
import c from "refractor/lang/c.js";
import csharp from "refractor/lang/csharp.js";
import css from "refractor/lang/css.js";
import sql from "refractor/lang/sql.js";
import r from "refractor/lang/r.js";
import swift from "refractor/lang/swift.js";
import rust from "refractor/lang/rust.js";
import go from "refractor/lang/go.js";
import kotlin from "refractor/lang/kotlin.js";
import { cn } from "@/lib/utils";

type HighlightNode = {
  type: "text" | "element";
  value?: string;
  children?: HighlightNode[];
  properties?: {
    className?: string[];
  };
};

function registerLanguage(grammar: Parameters<typeof refractor.register>[0]) {
  try {
    refractor.register(grammar);
  } catch {
    // already registered
  }
}

[
  tsx,
  typescript,
  javascript,
  jsx,
  json,
  python,
  bash,
  diff,
  markup,
  markdown,
  cpp,
  c,
  csharp,
  css,
  sql,
  r,
  swift,
  rust,
  go,
  kotlin,
].forEach(registerLanguage);

type CodeSnippetProps = {
  code: string;
  language?: string;
  wrap?: boolean;
} & ComponentPropsWithoutRef<"pre">;

export function CodeSnippet({ code, language = "tsx", wrap = false, className, ...props }: CodeSnippetProps) {
  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage === "diff") {
    return (
      <pre
        className={cn(
          "relative w-full max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 font-mono text-xs leading-relaxed text-slate-100",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
          className
        )}
        {...props}
      >
        <code className="block">{renderDiffLines(code)}</code>
      </pre>
    );
  }

  const nodes = highlightSafely(code, normalizedLanguage);

  return (
    <pre
      className={cn(
        "relative w-full max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 font-mono text-xs leading-relaxed text-slate-100",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        className
      )}
      {...props}
    >
      <code className={cn("block", `language-${normalizedLanguage}`)}>{renderNodes(nodes)}</code>
    </pre>
  );
}

function normalizeLanguage(language?: string): string {
  const lower = (language || "tsx").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "c++": "cpp",
    "c#": "csharp",
    "md": "markdown",
    "shell": "bash",
    "sh": "bash",
    "html": "markup",
  };
  return aliases[lower] || lower;
}

function renderDiffLines(code: string): ReactNode {
  const lines = code.split("\n");
  return lines.map((line, index) => {
    const isInsert = line.startsWith("+") && !line.startsWith("+++");
    const isDelete = line.startsWith("-") && !line.startsWith("---");
    const isMeta = line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++");
    return (
      <span
        key={`${index}-${line.slice(0, 12)}`}
        className={cn(
          "block px-1",
          isInsert && "bg-emerald-500/10 text-emerald-200",
          isDelete && "bg-rose-500/10 text-rose-200",
          isMeta && "text-slate-400"
        )}
      >
        {line || " "}
      </span>
    );
  });
}

function highlightSafely(code: string, language: string): HighlightNode[] {
  try {
    const highlighted = refractor.highlight(code, language) as unknown as HighlightNode[] | { type: string; children: HighlightNode[] };
    if (Array.isArray(highlighted)) {
      return highlighted;
    }
    if (highlighted && "children" in highlighted) {
      return highlighted.children ?? [];
    }
    return [];
  } catch {
    return [{ type: "text", value: code }] as HighlightNode[];
  }
}

function renderNodes(nodes: HighlightNode[]): ReactNode {
  return nodes.map((node, index) => renderNode(node, index));
}

function renderNode(node: HighlightNode, key: number): ReactNode {
  if (node.type === "text") {
    return node.value;
  }

  if (node.type === "element") {
    const className = Array.isArray(node.properties?.className)
      ? node.properties?.className.join(" ")
      : node.properties?.className;
    return (
      <span key={key} className={className}>
        {(node.children || []).map((child: HighlightNode, childIndex: number) => renderNode(child, childIndex))}
      </span>
    );
  }

  return null;
}
