type Block = { kind: 'heading'; text: string } | { kind: 'list'; items: string[] } | { kind: 'paragraph'; lines: string[] };

const HEADING = /^#{1,3}\s+(.+)$/;
const BULLET = /^[-•*]\s+(.+)$/;

/** Splits the product's plain-text description into blocks: blank lines
 * separate paragraphs, "## " lines are headings, "- " / "• " lines are list
 * items. Staff type it in the dashboard; nothing in it is ever treated as HTML. */
export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    if (!line) {
      current = null;
    } else if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] });
      current = null;
    } else if (bullet) {
      if (current?.kind !== 'list') blocks.push((current = { kind: 'list', items: [] }));
      current.items.push(bullet[1]);
    } else {
      if (current?.kind !== 'paragraph') blocks.push((current = { kind: 'paragraph', lines: [] }));
      current.lines.push(line);
    }
  }
  return blocks;
}

/** A product's full description, rendered as React text only (no HTML). */
export default function RichDescription({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4 text-body-lg text-ink-secondary">
      {parseDescription(text).map((block, i) =>
        block.kind === 'heading' ? (
          <h3 key={i} className="mt-2 text-headline-sm text-ink">{block.text}</h3>
        ) : block.kind === 'list' ? (
          <ul key={i} className="flex flex-col gap-2 ps-5 list-disc marker:text-primary">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
