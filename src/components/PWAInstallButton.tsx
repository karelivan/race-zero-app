import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
        <Check className="w-3.5 h-3.5" />
        PWA Instalada
      </span>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-3.5 h-3.5" />
        {isIOS ? 'Instalar en iOS' : 'Instalar PWA'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-100">
                  Instalar AERO-X 99 Offline
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  Para instalar <strong>AERO-X 99</strong> en tu iPhone o iPad y jugar a pantalla completa sin conexión:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-200">
                  <li>
                    Toca el botón <strong>Compartir</strong> en la barra de Safari.
                  </li>
                  <li>
                    Desliza hacia abajo y selecciona <strong>Añadir a pantalla de inicio</strong>.
                  </li>
                  <li>
                    Pulsa <strong>Añadir</strong> en la esquina superior derecha.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  <strong>AERO-X 99</strong> está lista con Service Worker activo para jugar offline.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-200">
                  <li>
                    Si estás en vista previa dentro de un marco, abre la aplicación en una pestaña dedicada.
                  </li>
                  <li>
                    Haz clic en el icono <strong>Instalar aplicación</strong> en la barra de direcciones de tu navegador (Chrome, Edge o Android).
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
