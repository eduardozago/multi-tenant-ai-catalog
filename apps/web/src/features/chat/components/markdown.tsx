import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Styled element by element with theme tokens instead of @tailwindcss/typography (not a
// dependency), so it follows dark mode like the rest of the app.
const components: Components = {
  p: ({ node: _, ...props }) => <p className="leading-relaxed" {...props} />,
  ul: ({ node: _, ...props }) => <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />,
  ol: ({ node: _, ...props }) => <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />,
  li: ({ node: _, ...props }) => <li className="pl-0.5" {...props} />,
  strong: ({ node: _, ...props }) => <strong className="font-semibold" {...props} />,
  h1: ({ node: _, ...props }) => <h3 className="text-base font-semibold" {...props} />,
  h2: ({ node: _, ...props }) => <h3 className="text-base font-semibold" {...props} />,
  h3: ({ node: _, ...props }) => <h4 className="font-semibold" {...props} />,
  // Model output can contain links; they leave the app and do not get its referrer.
  a: ({ node: _, ...props }) => (
    <a className="underline underline-offset-3 hover:text-primary" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  code: ({ node: _, className, ...props }) => (
    <code className={cn("bg-muted px-1 py-0.5 font-mono text-[0.9em]", className)} {...props} />
  ),
  pre: ({ node: _, ...props }) => (
    <pre className="overflow-x-auto bg-muted p-3 [&_code]:bg-transparent [&_code]:p-0" {...props} />
  ),
  blockquote: ({ node: _, ...props }) => (
    <blockquote className="border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  hr: () => <hr className="border-border" />,
  // A comparison table can be wider than a phone: it scrolls on its own, not the page.
  table: ({ node: _, ...props }) => (
    <div className="max-w-full overflow-x-auto border">
      <table className="w-full border-collapse text-left tabular-nums" {...props} />
    </div>
  ),
  th: ({ node: _, ...props }) => <th className="border-b bg-muted/50 px-2.5 py-1.5 font-medium" {...props} />,
  td: ({ node: _, ...props }) => <td className="border-b px-2.5 py-1.5 align-top" {...props} />,
  // The model has no image source we trust; product images come from the cards.
  img: () => null,
};

/**
 * Assistant text as markdown (GFM: tables, lists, bold, strikethrough). Raw HTML is not
 * enabled (no rehype-raw): react-markdown escapes it, so model output cannot inject
 * markup or scripts. Memoized: while streaming only the message being written changes.
 * `streaming` shows the blinking caret (CSS in index.css).
 */
export const Markdown = memo(function Markdown({ children, streaming = false }: { children: string; streaming?: boolean }) {
  return (
    <div data-streaming={streaming} className="flex min-w-0 flex-col gap-3 text-sm wrap-break-word">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
