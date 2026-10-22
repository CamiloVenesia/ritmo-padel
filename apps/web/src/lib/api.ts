import { isDemo, demoAdmin, demoAvailability, demoBookings, demoCancelBooking, demoCourts, demoCreateBooking, demoLogin, demoLogout, demoUser } from './demo';
import { ClientError, type AdminOverview, type Availability, type Booking, type Court, type User } from './types';

async function call<T>(path: string, init?: RequestInit):Promise<T>{
  let response:Response;
  try { response=await fetch(`/api${path}`, {credentials:'same-origin',signal:AbortSignal.timeout(12_000),...init,headers:{'Content-Type':'application/json',...init?.headers}}); }
  catch (error) { throw new ClientError('NETWORK_ERROR', (error instanceof DOMException && error.name === 'TimeoutError') ? 'El servidor tardó demasiado en responder. Reintentá.' : 'No podemos contactar al servidor. Revisá tu conexión.'); }
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new ClientError(data.code||'REQUEST_FAILED',data.message||'No se pudo completar la operación.');
  return data as T;
}
const json=(value:unknown)=>({ method:'POST', body:JSON.stringify(value) });
export const api = {
  isDemo,
  courts: async ():Promise<{courts:Court[]}> => isDemo?demoCourts():call('/public/courts'),
  availability: async (date:string):Promise<Availability> => isDemo?demoAvailability(date):call(`/public/availability?date=${encodeURIComponent(date)}`),
  me: async ():Promise<{user:User|null}> => isDemo?{user:demoUser()}:call('/auth/me'),
  login: async (email:string,password:string):Promise<{user:User}> => isDemo?demoLogin(email.includes('admin')?'Equipo RITMO':'Alex Rivera',email.includes('admin')?'admin':'player'):call('/auth/login',json({email,password})),
  register: async (fullName:string,email:string,password:string):Promise<{user:User}> => isDemo?demoLogin(fullName):call('/auth/register',json({fullName,email,password})),
  demoEnter: async (role:User['role']):Promise<{user:User}> => demoLogin(role==='admin'?'Equipo RITMO':'Alex Rivera',role),
  logout: async ():Promise<void> => { if(isDemo) return demoLogout(); await call('/auth/logout',{method:'POST'}); },
  myBookings: async ():Promise<{bookings:Booking[]}> => isDemo?demoBookings():call('/bookings/me'),
  createBooking: async (input:{courtId:string;date:string;time:string}):Promise<{booking:Booking}> => isDemo?demoCreateBooking(input):call('/bookings',json(input)),
  cancelBooking: async (id:string):Promise<void> => isDemo?demoCancelBooking(id):call(`/bookings/${encodeURIComponent(id)}/cancel`,{method:'PATCH'}),
  adminOverview: async ():Promise<AdminOverview> => isDemo?demoAdmin():call('/admin/overview'),
  blockCourt: async (input:{courtId:string;date:string;start:string;end:string;reason:string}):Promise<void> => isDemo?Promise.reject(new ClientError('DEMO_ONLY','Los bloqueos requieren el servidor real.')):call('/admin/blocks',json(input)),
  removeBlock: async (id:string):Promise<void> => isDemo?Promise.reject(new ClientError('DEMO_ONLY','Los bloqueos requieren el servidor real.')):call(`/admin/blocks/${id}`,{method:'DELETE'})
};
