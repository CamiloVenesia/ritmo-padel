export const clubZone = 'America/Argentina/Buenos_Aires';
export const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(cents / 100);
export function localDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: clubZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const find = (type:string) => parts.find(p=>p.type===type)?.value ?? '';
  return `${find('year')}-${find('month')}-${find('day')}`;
}
export function offsetDate(days = 0): string {
  const [year,month,day] = localDate().split('-').map(Number);
  return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
}
export function displayDate(date: string, options: Intl.DateTimeFormatOptions = {weekday:'long', day:'numeric', month:'long'}): string {
  return new Intl.DateTimeFormat('es-AR', {timeZone:'UTC',...options}).format(new Date(`${date}T12:00:00Z`));
}
export function displayDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {timeZone:clubZone, day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
export function toMinutes(time: string): number { const [h,m] = time.split(':').map(Number); return h*60+m; }
