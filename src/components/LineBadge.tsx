interface Props {
  name: string;
  color: string;
  textColor: string;
  size?: 'sm' | 'md';
}

export function LineBadge({ name, color, textColor, size = 'md' }: Props) {
  const sizing = size === 'sm' ? 'h-5 min-w-7 px-1.5 text-[11px]' : 'h-7 min-w-10 px-2 text-sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold tracking-tight ${sizing}`}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  );
}
