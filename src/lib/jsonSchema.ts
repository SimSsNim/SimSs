// lesson.schema.json 에 쓰인 JSON Schema(2020-12) 기능만 구현한 작은 검사기.
// 스키마 파일 자체를 읽어서 검사하므로 스키마를 바꾸면 앱도 자동으로 따라간다.
// format: 파이썬 jsonschema 기본 설치와 같게 'date' 만 검사하고 'uri' 는 검사하지 않는다
// (jsonschema 는 rfc3987 같은 추가 패키지가 없으면 uri 를 검사하지 않음).
type S = Record<string, unknown>;
export interface SchemaError { path: string; message: string }

const typeOf = (v: unknown): string => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
};
const matchesType = (v: unknown, t: string) => {
  const actual = typeOf(v);
  return t === actual || (t === 'number' && actual === 'integer');
};
const isValidDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const show = (v: unknown) => JSON.stringify(v);

export function validateSchema(schema: S, value: unknown, path: (string | number)[] = []): SchemaError[] {
  const errs: SchemaError[] = [];
  const at = path.join('/') || '(root)';
  const add = (message: string) => errs.push({ path: at, message });

  if ('const' in schema && show(value) !== show(schema.const)) add(`${show(schema.const)} was expected`);
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => show(e) === show(value))) add(`${show(value)} is not one of ${show(schema.enum)}`);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => matchesType(value, t))) {
      add(`${show(value)} is not of type ${types.map((t) => `'${t}'`).join(', ')}`);
      return errs; // 타입이 다르면 하위 검사는 의미 없음
    }
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && [...value].length < schema.minLength) add(`${show(value)} is too short`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) add(`${show(value)} does not match ${show(schema.pattern)}`);
    if (schema.format === 'date' && !isValidDate(value)) add(`${show(value)} is not a 'date'`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) add(`${value} is less than the minimum of ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) add(`${value} is greater than the maximum of ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) add(`should be non-empty / too short (min ${schema.minItems})`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) add(`is too long (max ${schema.maxItems})`);
    if (schema.items && typeof schema.items === 'object') value.forEach((v, i) => errs.push(...validateSchema(schema.items as S, v, [...path, i])));
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, S>;
    for (const r of (schema.required as string[] | undefined) ?? []) if (!(r in obj)) add(`'${r}' is a required property`);
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) errs.push(...validateSchema(props[k], v, [...path, k]));
      else if (schema.additionalProperties === false) add(`Additional properties are not allowed ('${k}' was unexpected)`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validateSchema(schema.additionalProperties as S, v, [...path, k]));
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const n = (schema.oneOf as S[]).filter((sub) => validateSchema(sub, value, path).length === 0).length;
    if (n !== 1) add(n === 0 ? `${show(value)} is not valid under any of the given schemas` : `${show(value)} is valid under each of several schemas`);
  }
  if (Array.isArray(schema.anyOf) && !(schema.anyOf as S[]).some((sub) => validateSchema(sub, value, path).length === 0)) add('is not valid under any of the given schemas (anyOf)');
  if (schema.not && typeof schema.not === 'object' && validateSchema(schema.not as S, value, path).length === 0) add(`should not be valid under ${show(schema.not)}`);
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf as S[]) {
      if (sub.if && typeof sub.if === 'object') {
        const cond = validateSchema(sub.if as S, value, path).length === 0;
        if (cond && sub.then) errs.push(...validateSchema(sub.then as S, value, path));
        if (!cond && sub.else) errs.push(...validateSchema(sub.else as S, value, path));
      } else errs.push(...validateSchema(sub, value, path));
    }
  }
  return errs;
}
