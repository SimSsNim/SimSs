import s from '../styles/ui.module.css';

/** 단순 선택 칩 묶음 */
export function FilterChipsGeneric({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <>
      {options.map(([v, label]) => (
        <button key={v} type="button" className={s.chip} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </>
  );
}
