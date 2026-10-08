/** Structured data (schema.org) for search engines. Values must come from
 * real data — never invented ratings, prices or availability. `<` is escaped
 * so text inside the data can't close the script tag. */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
