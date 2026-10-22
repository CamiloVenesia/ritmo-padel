import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Menu, UserRound, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function Logo({ light=false }: {light?:boolean}) {
  return <Link to="/" className={`logo ${light?'logo--light':''}`} aria-label="RITMO Pádel, inicio">
    <span className="logo-mark"><span className="logo-mark__dot"/><span className="logo-mark__slash"/></span>
    <span className="logo-type">RITMO<span className="logo-type__small">PÁDEL CLUB</span></span>
  </Link>;
}
export function SiteHeader() {
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[open]);
  const { data }=useQuery({queryKey:['session'],queryFn:api.me});
  const user=data?.user;
  const links=[{to:'/',label:'El club'},{to:'/reservar',label:'Reservar cancha'},{to:'/mis-reservas',label:'Mis reservas'},...(user?.role==='admin'?[{to:'/admin',label:'Administración'}]:[])];
  return <>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    {api.isDemo && <div className="demo-ribbon"><span className="demo-ribbon__dot"/> MODO DEMOSTRACIÓN <span className="demo-ribbon__mid">·</span> Los turnos en esta vista son simulados. <span className="demo-ribbon__end">Proyecto de portfolio</span></div>}
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Navegación principal">
          {links.map(l=><NavLink key={l.to} to={l.to} end={l.to==='/'} className={({isActive})=>isActive?'nav-link nav-link--active':'nav-link'}>{l.label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <Link className="account-link" to={user?'/mis-reservas':'/acceso'}><UserRound size={18}/><span>{user?user.fullName.split(' ')[0]:'Mi cuenta'}</span></Link>
          <Link to="/reservar" className="btn btn-lime btn-header">Reservar <ArrowUpRight size={17}/></Link>
          <button className="mobile-toggle" onClick={()=>setOpen(!open)} aria-label={open?'Cerrar menú':'Abrir menú'} aria-expanded={open} aria-controls="mobile-menu">{open?<X/>:<Menu/>}</button>
        </div>
      </div>
      <nav className={`mobile-nav ${open?'mobile-nav--open':''}`} id="mobile-menu" aria-label="Menú móvil" inert={!open}>
        {links.map(l=><Link key={l.to} to={l.to} onClick={()=>setOpen(false)}>{l.label}<ArrowUpRight size={18}/></Link>)}
        <Link to={user?'/mis-reservas':'/acceso'} onClick={()=>setOpen(false)}><CalendarDays size={18}/> {user?'Mi perfil':'Iniciar sesión'}</Link>
      </nav>
    </header>
  </>;
}
export function SiteFooter(){return <footer className="site-footer"><div className="container footer-inner"><div className="footer-primary"><Logo light/><p>El punto de encuentro<br/>de los que no paran de jugar.</p></div><div className="footer-nav"><Link to="/reservar">Reservar una cancha <ArrowUpRight size={15}/></Link><Link to="/mis-reservas">Mis reservas <ArrowUpRight size={15}/></Link><a href="/#club">Conocé el club <ArrowUpRight size={15}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RITMO PÁDEL. Concepto ficticio de portfolio.</span><span>ROSARIO, ARGENTINA <span className="footer-star">✳</span> ALL IN. ALL GAME.</span></div></div></footer>}
