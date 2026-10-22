import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { SiteHeader, SiteFooter } from './components/SiteHeader';
import { HomePage } from './pages/HomePage';
import { BookingPage } from './pages/BookingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { AccessPage } from './pages/AccessPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
function ScrollTop() { const {pathname}=useLocation(); useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[pathname]);return null; }
export function App(){return <><ScrollTop/><SiteHeader/><main id="main" tabIndex={-1}><Routes><Route path="/" element={<HomePage/>}/><Route path="/reservar" element={<BookingPage/>}/><Route path="/mis-reservas" element={<MyBookingsPage/>}/><Route path="/acceso" element={<AccessPage/>}/><Route path="/admin" element={<AdminPage/>}/><Route path="*" element={<NotFoundPage/>}/></Routes></main><SiteFooter/></>}
