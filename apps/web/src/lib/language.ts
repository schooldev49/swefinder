export function inferLanguageFromPath(filePath?: string): string {
  if (!filePath) return "";
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "markup";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".kt") || lower.endsWith(".kts")) return "kotlin";
  if (lower.endsWith(".swift")) return "swift";
  if (lower.endsWith(".r")) return "r";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".c")) return "c";
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx") || lower.endsWith(".hpp") || lower.endsWith(".hxx")) return "cpp";
  if (lower.endsWith(".cs")) return "csharp";
  return "";
}
