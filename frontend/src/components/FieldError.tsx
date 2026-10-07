/** The inline Arabic message under a form field. Give the field
 * `aria-invalid` and `aria-describedby={id}` while it's shown. */
export default function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[12px] mt-1 text-error">
      {message}
    </p>
  );
}

/** Props that connect an input to its FieldError. */
export function errorProps(id: string, message?: string | null) {
  return message
    ? { 'aria-invalid': true as const, 'aria-describedby': id, style: { borderColor: 'var(--color-error)' } }
    : {};
}
