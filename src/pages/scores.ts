import type { SummaryDay } from '../lib/types';
import { loadSummary, verdictLabel, fmtTemp, el } from './shared';

const $ = (id: string) => document.getElementById(id)!;

function table(days: SummaryDay[], empty: string): HTMLElement {
  if (!days.length) return el('p', {}, empty);
  const rows = days
    .slice()
    .reverse()
    .map((d) =>
      el(
        'tr',
        {},
        el('td', {}, el('a', { href: `archive.html?date=${d.date}` }, d.date)),
        el('td', {}, verdictLabel(d.verdict, d.possibleSnow, d.hailSeen)),
        el('td', {}, `${fmtTemp(d.minTemperatureC)} to ${fmtTemp(d.maxTemperatureC)}`),
        el('td', {}, el('a', { href: `data/days/${d.date}.json` }, 'JSON')),
      ),
    );
  const head = el('tr', {}, ...['Date', 'Verdict', 'Temperature range', 'Data'].map((h) => el('th', { scope: 'col' }, h)));
  return el('div', { className: 'table-scroll' }, el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows)));
}

async function main() {
  try {
    const s = await loadSummary();
    const dl = $('totals');
    const add = (k: string, v: string) => dl.append(el('dt', {}, k), el('dd', {}, v));
    dl.replaceChildren();
    add('Watching since', s.launchDate ?? 'Not yet');
    add('Days judged', String(s.days.length));
    add('Snow days', String(s.counts.SNOW));
    add('Sleet near-misses', String(s.counts.SLEET));
    add('Unconfirmed days', String(s.counts.UNCONFIRMED));
    add('Days with no data', String(s.counts.NO_DATA));
    add(
      'Longest run without snow',
      s.longestRunWithoutSnow.days
        ? `${s.longestRunWithoutSnow.days} days (${s.longestRunWithoutSnow.from} to ${s.longestRunWithoutSnow.to})`
        : '0 days',
    );
    add('Current run without snow', `${s.currentRunWithoutSnow} days`);
    $('snow-list').replaceChildren(table(s.days.filter((d) => d.verdict === 'SNOW'), 'No snow days recorded yet. The high score table awaits.'));
    $('sleet-list').replaceChildren(table(s.days.filter((d) => d.verdict === 'SLEET'), 'No sleet near-misses yet.'));
    $('possible-list').replaceChildren(
      table(s.days.filter((d) => d.verdict === 'UNCONFIRMED' && d.possibleSnow), 'None so far.'),
    );
  } catch {
    $('totals').replaceChildren(el('dt', {}, 'SIGNAL LOST'), el('dd', {}, 'The summary could not be loaded.'));
  }
}

void main();
