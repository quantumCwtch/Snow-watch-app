import raw from '../../config/snow-watch.json';

export type Config = typeof raw;
export const config: Config = raw;

export function codeLabel(code: number, cfg: Config = config): string {
  const labels = cfg.weatherCodes.labels as Record<string, string>;
  return labels[String(code)] ?? `Unknown code ${code}`;
}
