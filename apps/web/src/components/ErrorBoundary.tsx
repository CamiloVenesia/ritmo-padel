import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
export class ErrorBoundary extends React.Component<React.PropsWithChildren, { hasError:boolean }> {
  state={hasError:false};
  static getDerivedStateFromError() { return {hasError:true}; }
  componentDidCatch(error:Error, info:React.ErrorInfo) { console.error('RITMO rendering error',error, info.componentStack); }
  render() {
    if(this.state.hasError) return <div className="fatal-error"><div><AlertTriangle size={28}/><h1>Algo salió mal.</h1><p>Hubo un problema al mostrar esta pantalla. Tus reservas guardadas no se pierden.</p><button className="btn btn-lime" onClick={()=>window.location.reload()}><RotateCcw size={17}/> Recargar aplicación</button></div></div>;
    return this.props.children;
  }
}
