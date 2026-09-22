// "Lapor data salah" — prefills a GitHub issue against the `data.yml` template (see
// .github/ISSUE_TEMPLATE/data.yml) with whatever context is available: a popup click always
// knows layer/name/coords, the About sheet's general button knows only the app version.

const ISSUE_URL = 'https://github.com/nizmitz/jalanin/issues/new';

export interface IssueContext {
  layer?: string;
  name?: string;
  lat?: number;
  lon?: number;
  version: string;
}

function coordText(ctx: IssueContext): string {
  if (ctx.lat === undefined || ctx.lon === undefined) return '-';
  return `${String(ctx.lat)}, ${String(ctx.lon)}`;
}

export function buildIssueUrl(ctx: IssueContext): string {
  const title = ctx.name ? `Data salah: ${ctx.name}` : 'Data salah';
  const userAgent = typeof navigator === 'undefined' ? '-' : navigator.userAgent;
  // A YAML issue form is prefilled per field id, not with a single `body` parameter.
  const params = new URLSearchParams({
    template: 'data.yml',
    title,
    layer: ctx.layer ?? 'lainnya',
    where: coordText(ctx),
    context: [
      `Nama: ${ctx.name ?? '-'}`,
      `Versi aplikasi: ${ctx.version}`,
      `User agent: ${userAgent}`,
    ].join('\n'),
  });
  return `${ISSUE_URL}?${params.toString()}`;
}
