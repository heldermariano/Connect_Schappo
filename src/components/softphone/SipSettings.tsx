'use client';

import { useState, useEffect } from 'react';
import type { SipSettings as SipSettingsType, SipRegistrationState } from '@/lib/types';

interface SipSettingsProps {
  settings: SipSettingsType | null;
  onSave: (settings: SipSettingsType) => Promise<void>;
  registrationState: SipRegistrationState;
  onRegister: () => Promise<void>;
  onUnregister: () => Promise<void>;
}

export default function SipSettings({
  settings,
  onSave,
  registrationState,
  onRegister,
  onUnregister,
}: SipSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<SipSettingsType>({
    sip_server: '',
    sip_port: 8089,
    sip_username: '',
    sip_password: '',
    sip_transport: 'wss',
    sip_enabled: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const isRegistered = registrationState === 'registered';

  return (
    <div className="border-t border-gray-200">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuracoes SIP
        </div>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Servidor SIP</label>
            <input
              type="text"
              value={form.sip_server}
              onChange={(e) => setForm({ ...form, sip_server: e.target.value })}
              placeholder="pbx.exemplo.com"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-schappo-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Porta</label>
              <input
                type="number"
                value={form.sip_port}
                onChange={(e) => setForm({ ...form, sip_port: parseInt(e.target.value) || 8089 })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-schappo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Transporte</label>
              <select
                value={form.sip_transport}
                onChange={(e) => setForm({ ...form, sip_transport: e.target.value as 'wss' | 'ws' })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-schappo-500"
              >
                <option value="wss">WSS (seguro)</option>
                <option value="ws">WS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Usuario SIP</label>
            <input
              type="text"
              value={form.sip_username}
              onChange={(e) => setForm({ ...form, sip_username: e.target.value })}
              placeholder="201"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-schappo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Senha SIP</label>
            <input
              type="password"
              value={form.sip_password}
              onChange={(e) => setForm({ ...form, sip_password: e.target.value })}
              placeholder="******"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-schappo-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-schappo-500 rounded hover:bg-schappo-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={isRegistered ? onUnregister : onRegister}
              disabled={!form.sip_server || !form.sip_username}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                isRegistered
                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                  : 'text-green-600 bg-green-50 hover:bg-green-100'
              }`}
            >
              {isRegistered ? 'Desregistrar' : 'Registrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
