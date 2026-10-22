import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
export function NotFoundPage(){return <div className="page-bg not-found"><span>404 / OUT OF COURT</span><h1>ESA PELOTA<br/>SE FUE AFUERA.</h1><p>La página que buscás no existe. Pero todavía queda partido.</p><Link className="btn btn-lime" to="/">Volver al club <ArrowUpRight size={18}/></Link></div>}
