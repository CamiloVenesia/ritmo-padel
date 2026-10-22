import type { AdminOverview, Availability, Booking, Court, User } from './types';
import { ClientError } from './types';
import { clubZone, localDate, offsetDate, toMinutes } from './format';

const KEY_BOOKINGS = 'ritmo-demo-bookings-v1';
const KEY_USER = 'ritmo-demo-user-v1';
const pause = (ms=340) => new Promise(resolve=>setTimeout(resolve, ms));
export const isDemo = import.meta.env.VITE_DATA_MODE !== 'live';

const COURTS: Court[] = [
  { id:'demo-arena',slug:'arena',name:'ARENA 01',subtitle:'La central',surface:'Césped WPT',location:'Indoor · Planta baja',accent:'lime',features:['Panorámica','Indoor','Iluminación LED'],basePriceCents:2200000,peakPriceCents:2800000,active:true },
  { id:'demo-pulse',slug:'pulse',name:'PULSE 02',subtitle:'La eléctrica',surface:'Césped Mondo',location:'Indoor · Planta baja',accent:'teal',features:['Panorámica','Indoor','Premium'],basePriceCents:2200000,peakPriceCents:2800000,active:true },
  { id:'demo-terra',slug:'terra',name:'TERRA 03',subtitle:'El clásico',surface:'Césped sintético',location:'Outdoor · Patio norte',accent:'amber',features:['Outdoor','Vestuarios','Clásica'],basePriceCents:1800000,peakPriceCents:2300000,active:true },
  { id:'demo-sky',slug:'sky',name:'SKY 04',subtitle:'Bajo las estrellas',surface:'Césped Mondo',location:'Outdoor · Terraza',accent:'blue',features:['Outdoor','Panorámica','Premium'],basePriceCents:2400000,peakPriceCents:3000000,active:true }
];

function sampleBookings(): (Booking & { playerName: string; playerEmail: string })[] {
  const people = [
    ['Luna Fernández','luna@demo.test'], ['Tomás Rivas','tomas@demo.test'],
    ['Micaela Díaz','mica@demo.test'], ['Nicolás Costa','nico@demo.test'],
    ['Julieta Sosa','juli@demo.test'], ['Facundo Vera','facu@demo.test']
  ];
  const fixtures = [
    [0,'demo-arena','ARENA 01','18:00',2800000],
    [1,'demo-pulse','PULSE 02','20:00',2800000],
    [0,'demo-terra','TERRA 03','17:00',1800000],
    [2,'demo-sky','SKY 04','19:30',3000000],
    [1,'demo-arena','ARENA 01','11:00',2200000],
    [3,'demo-terra','TERRA 03','16:30',1800000]
  ] as const;
  return fixtures.map(([day,courtId,courtName,time,priceCents],i)=>{
    const date=offsetDate(day);
    const minutes=toMinutes(time)+90;
    const ends=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    return {id:`fixture-${i+1}`,courtId,courtName,startsAt:`${date}T${time}:00-03:00`,endsAt:`${date}T${ends}:00-03:00`,status:'confirmed' as const,priceCents,createdAt:new Date().toISOString(),playerName:people[i][0],playerEmail:people[i][1]};
  });
}
function storedBookings(): Booking[] {
  try { const value = JSON.parse(localStorage.getItem(KEY_BOOKINGS) || '[]'); return Array.isArray(value)? value : []; } catch { return []; }
}
function saveBookings(bookings: Booking[]) { localStorage.setItem(KEY_BOOKINGS, JSON.stringify(bookings)); }
export async function demoCourts() { await pause(200); return { courts: COURTS }; }
export function demoUser(): User | null { try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); } catch { return null; } }
export async function demoLogin(fullName='Alex Rivera', role: User['role']='player'): Promise<{user:User}> {
  await pause();
  const user: User = {id:role==='admin'?'demo-admin':'demo-player',fullName,email:role==='admin'?'admin@ritmo.demo':'jugador@ritmo.demo',role};
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  return {user};
}
export async function demoLogout() { localStorage.removeItem(KEY_USER); await pause(120); }
function isoFrom(date:string, time:string) { return `${date}T${time}:00-03:00`; } // En la demo el club opera en Rosario, UTC-03.
export async function demoAvailability(date: string): Promise<Availability> {
  await pause(240);
  const bookings = [...storedBookings(),...sampleBookings()].filter(b=>b.status==='confirmed');
  const currentDate = localDate();
  if (date < currentDate || date > offsetDate(14)) throw new ClientError('INVALID_DATE','Fecha fuera del período habilitado.');
  const courts = COURTS.map((court,ci)=>({
    ...court,
    slots: Array.from({length:28},(_,i)=> {
      const timeMinutes=480+i*30;
      const time=`${String(Math.floor(timeMinutes/60)).padStart(2,'0')}:${String(timeMinutes%60).padStart(2,'0')}`;
      const endMinutes=timeMinutes+90;
      const ends=`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
      const peak=timeMinutes>=1080;
      const occupied=bookings.some(b=>b.courtId===court.id && b.startsAt.slice(0,10)===date && toMinutes(b.startsAt.slice(11,16))<timeMinutes+90 && toMinutes(b.endsAt.slice(11,16))>timeMinutes);
      // Ocupación de ejemplo. La lógica real se comprueba en PostgreSQL.
      const illustrative=((i+ci*7+Number(date.slice(-2)))%17===0 || (i+ci*5)%23===0);
      const expired=date===currentDate && new Date(isoFrom(date,time)).getTime()<Date.now()+30*60_000;
      return {time,ends,available:!occupied&&!illustrative&&!expired,priceCents:peak?court.peakPriceCents:court.basePriceCents};
    })
  }));
  return {date,durationMinutes:90,courts};
}
export async function demoBookings(): Promise<{bookings:Booking[]}> { await pause(); return {bookings:storedBookings().sort((a,b)=>b.startsAt.localeCompare(a.startsAt))}; }
export async function demoCreateBooking(input:{courtId:string;date:string;time:string}):Promise<{booking:Booking}> {
  const user=demoUser(); if (!user) throw new ClientError('AUTH_REQUIRED','Entrá como jugador para continuar.');
  const avail=await demoAvailability(input.date);
  const court=avail.courts.find(c=>c.id===input.courtId);
  const slot=court?.slots.find(s=>s.time===input.time);
  if(!court||!slot||!slot.available) throw new ClientError('SLOT_TAKEN','Ese horario ya no está disponible.');
  const booking:Booking={id:crypto.randomUUID(),courtId:court.id,courtName:court.name,startsAt:isoFrom(input.date,input.time),endsAt:isoFrom(input.date,slot.ends),status:'confirmed',priceCents:slot.priceCents,createdAt:new Date().toISOString()};
  saveBookings([...storedBookings(),booking]); await pause(); return {booking};
}
export async function demoCancelBooking(id:string):Promise<void> {
  const bookings=storedBookings();const b=bookings.find(b=>b.id===id);
  if(!b) throw new ClientError('BOOKING_NOT_FOUND','Reserva no encontrada.');
  if(new Date(b.startsAt).getTime()-Date.now()<2*3600_000) throw new ClientError('CANCELLATION_WINDOW','Podés cancelar hasta 2 horas antes.');
  saveBookings(bookings.map(b=>b.id===id?{...b,status:'cancelled' as const}:b)); await pause();
}
export async function demoAdmin():Promise<AdminOverview>{
  await pause();
  const fixtures=sampleBookings();
  const own=storedBookings().map(b=>({...b,playerName:'Alex Rivera',playerEmail:'jugador@ritmo.demo'}));
  const bookings=[...fixtures,...own].sort((a,b)=>b.startsAt.localeCompare(a.startsAt));
  return {
    stats:{
      courts:4,
      next24h:bookings.filter(b=>b.status==='confirmed'&&new Date(b.startsAt).getTime()<Date.now()+86400000&&new Date(b.startsAt).getTime()>Date.now()).length,
      monthBookings:bookings.filter(b=>b.status==='confirmed').length,
      monthRevenueCents:bookings.filter(b=>b.status==='confirmed').reduce((sum,b)=>sum+b.priceCents,0)
    },
    bookings,
    blocks:[]
  };
}
