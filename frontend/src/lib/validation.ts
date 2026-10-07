/** Customer-facing form checks — one Arabic message per problem, the same
 * rules the backend enforces (it re-checks everything). Forms use these
 * with `noValidate`, so the browser never shows its own (often English)
 * validation bubbles. Each returns the message to show, or null if valid. */

const EGYPT_PHONE = /^01\d{9}$/;

export function validateFullName(value: string): string | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'اكتبي اسمك بالكامل';
  if (parts.length !== 3) return 'الاسم لازم يكون ثلاثي (اسم أول، أب، جد) مفصول بمسافات';
  return null;
}

export function validateName(value: string): string | null {
  return value.trim().length < 2 ? 'اكتبي اسمك' : null;
}

export function validatePhone(value: string): string | null {
  const v = value.trim();
  if (!v) return 'اكتبي رقم التليفون';
  if (!EGYPT_PHONE.test(v)) return 'رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم';
  return null;
}

export function validateNewPassword(value: string): string | null {
  if (!value) return 'اكتبي كلمة المرور';
  if (value.length < 6) return 'كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل';
  return null;
}

export function validateRequired(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

export function validateOptionalEmail(value: string): string | null {
  const v = value.trim();
  return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'البريد الإلكتروني مش مكتوب صح' : null;
}

export type FieldErrors<K extends string> = Partial<Record<K, string | null>>;

/** True if any field has an error; moves focus to the first invalid field
 * (by element id = `${prefix}${field}`), in the order the fields are given. */
export function focusFirstError<K extends string>(errors: FieldErrors<K>, order: K[], prefix: string): boolean {
  const first = order.find((k) => errors[k]);
  if (first) document.getElementById(`${prefix}${first}`)?.focus();
  return !!first;
}
