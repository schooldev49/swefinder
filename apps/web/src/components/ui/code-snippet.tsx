import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { refractor } from "refractor/lib/core";
import tsx from "refractor/lang/tsx.js";
import typescript from "refractor/lang/typescript.js";
import javascript from "refractor/lang/javascript.js";
import jsx from "refractor/lang/jsx.js";
import json from "refractor/lang/json.js";
import python from "refractor/lang/python.js";
import bash from "refractor/lang/bash.js";
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

[tsx, typescript, javascript, jsx, json, python, bash].forEach(registerLanguage);

type CodeSnippetProps = {
  code: string;
  language?: string;
  wrap?: boolean;
} & ComponentPropsWithoutRef<"pre">;

export function CodeSnippet({ code, language = "tsx", wrap = false, className, ...props }: CodeSnippetProps) {
  const nodes = highlightSafely(code, language);

  return (
    <pre
      className={cn(
        "relative w-full max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 font-mono text-xs leading-relaxed text-slate-100",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        className
      )}
      {...props}
    >
      <code className={cn("block", `language-${language}`)}>{renderNodes(nodes)}</code>
    </pre>
  );
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
