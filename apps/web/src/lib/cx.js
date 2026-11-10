/** Join class names, skipping empty values: cx('a', cond && 'b') */
export const cx = (...parts) => parts.filter(Boolean).join(' ');
