type MarkdownBlock =
  | {
      type: "heading";
      level: number;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    };

export function AgreementContent({
  markdown,
  compact = false,
  hideFirstHeading = false
}: {
  markdown: string;
  compact?: boolean;
  hideFirstHeading?: boolean;
}) {
  const className = compact
    ? "sprix-agreement-content sprix-agreement-content-compact"
    : "sprix-agreement-content";
  const blocks = parseAgreementMarkdown(markdown);
  const visibleBlocks = hideFirstHeading && blocks[0]?.type === "heading" && blocks[0].level === 1 ? blocks.slice(1) : blocks;

  return (
    <article className={className}>
      {visibleBlocks.map((block, index) => (
        <AgreementBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </article>
  );
}

function AgreementBlock({ block }: { block: MarkdownBlock }) {
  if (block.type === "heading") {
    return <h3 data-level={block.level}>{block.text}</h3>;
  }

  return <p>{block.text}</p>;
}

function parseAgreementMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({
      type: "paragraph",
      text: paragraphLines.join("\n")
    });
    paragraphLines.length = 0;
  };

  markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trimEnd();
      const heading = line.match(/^(#{1,3})\s+(.+)$/);

      if (!line.trim()) {
        flushParagraph();
        return;
      }

      if (heading) {
        flushParagraph();
        blocks.push({
          type: "heading",
          level: heading[1].length,
          text: heading[2].trim()
        });
        return;
      }

      paragraphLines.push(line.trim());
    });

  flushParagraph();
  return blocks;
}
