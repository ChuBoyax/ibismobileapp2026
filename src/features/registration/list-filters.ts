import type { FilterOption } from '@/components/filter-bar';
import type { ListFilters, OptionGroups } from '@/lib/api';

/**
 * Ginagawang pagpipilian sa filter ang mga option na galing sa server.
 *
 * ANG PINAGMULAN AY ANG NAKA-TABI NANG /options — iyon din ang ginagamit ng
 * registration form, at naitatago na sa cellphone bago pa man mawalan ng
 * signal. Kaya gumagana ang chip offline nang hindi kailangan ng sariling
 * pagkuha: ang listahan ng purok na napili mo sa bundok ay ang parehong
 * listahang nakita mo sa opisina.
 */
export function choicesFrom(
  options: OptionGroups,
  key: string,
  allLabel: string
): FilterOption[] {
  const group = options[key] ?? [];

  return [
    { value: null, label: allLabel },
    ...group.map((option) => ({ value: option.id, label: option.name })),
  ];
}

/**
 * Tumugma ba ang tala sa isang salain, kapag walang koneksyon?
 *
 * Ang tuntunin ay simple at pare-pareho: kung ang tala ay may field na
 * kaparehong pangalan ng salain, dapat magkatugma ang halaga. Ang hindi
 * napipiling salain (null) ay hindi sumasala.
 *
 * Ang paghahambing ay sa teksto, hindi sa uri. Ang id na galing sa naka-save
 * na JSON ay minsang numero at minsang teksto — hindi dapat maging dahilan
 * iyon para maglaho ang tala sa listahan.
 */
export function matchesById(
  item: Record<string, unknown>,
  filters: ListFilters,
  keys: string[]
): boolean {
  return keys.every((key) => {
    const wanted = filters[key];

    if (wanted === null || wanted === undefined || wanted === '') return true;

    return String(item[key] ?? '') === String(wanted);
  });
}

/**
 * Ang mga sektor na kayang salain ng listahan ng residente.
 *
 * Hindi ito dropdown sa database kundi hanay ng magkakahiwalay na boolean na
 * column. Iisang chip ang ipinapakita — "alin sa mga pangkat" — dahil ang
 * limang magkakahiwalay na switch ay mas mahirap unawain kaysa sa isang
 * tanong na may malinaw na sagot.
 *
 * Ang susi ay siya ring ipinapadala sa server; ang column ay ang tugma nito
 * sa naka-save na tala kapag walang signal.
 */
export const RESIDENT_SECTORS: { key: string; label: string; column: string }[] = [
  { key: 'senior', label: 'Senior citizens', column: 'senior' },
  { key: 'pwd', label: 'Persons with disability', column: 'pwd' },
  { key: '4ps', label: '4Ps members', column: 'is_4ps_member' },
  { key: 'solo_parent', label: 'Solo parents', column: 'solo_parent' },
  { key: 'osy', label: 'Out-of-school youth', column: 'osy' },
  { key: 'ofw', label: 'OFWs', column: 'ofw' },
];

export const SECTOR_CHOICES: FilterOption[] = [
  { value: null, label: 'All residents' },
  ...RESIDENT_SECTORS.map((sector) => ({ value: sector.key, label: sector.label })),
];

/** Totoo kapag kabilang ang residente sa napiling sektor. */
export function matchesSector(item: Record<string, unknown>, value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;

  const sector = RESIDENT_SECTORS.find((entry) => entry.key === value);

  return sector ? item[sector.column] === true : true;
}
