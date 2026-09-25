'use client';

import React from 'react';
import { Printer, MessageSquare, X, ChefHat, Check } from 'lucide-react';
import { KOTPrintTicket } from '@/types';
import { useToast } from '@/components/ui/LuxuryNotifications';

interface KOTThermalInvoiceProps {
  ticket: KOTPrintTicket;
  onClose: () => void;
  branchId?: string;
}

export default function KOTThermalInvoice({ ticket, onClose, branchId }: KOTThermalInvoiceProps) {
  const toast = useToast();
  const [sendingWa, setSendingWa] = React.useState(false);
  const [waSent, setWaSent] = React.useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendChefWhatsApp = async () => {
    setSendingWa(true);
    try {
      const res = await fetch('/api/whatsapp/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: ticket.order_id,
          branch_id: branchId,
          table_number: ticket.table_number,
          round_number: ticket.round_number,
          orderType: ticket.order_type,
          order_notes: ticket.order_notes,
          items: ticket.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            notes: i.notes || '',
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch to WhatsApp');

      setWaSent(true);
      toast.success('KOT Dispatched', `Sent to chef WhatsApp (${data.branch || 'Kitchen terminal'})`);
    } catch (err: any) {
      toast.error('Dispatch Failed', err.message || 'Could not send WhatsApp KOT');
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-gray-100">
        
        {/* Modal Controls Header (Hidden on Print) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5 print:hidden">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm tracking-wide">Kitchen Order Ticket (KOT)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar (Hidden on Print) */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-black/40 border-b border-white/5 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print KOT Slip (80mm)</span>
          </button>

          <button
            onClick={handleSendChefWhatsApp}
            disabled={sendingWa}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              waSent 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
            }`}
          >
            {waSent ? <Check className="w-4 h-4 text-emerald-400" /> : <MessageSquare className="w-4 h-4 text-emerald-400" />}
            <span>{waSent ? 'Sent' : 'WhatsApp'}</span>
          </button>
        </div>

        {/* Thermal Slip Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-zinc-900/60 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
          
          {/* Printable 80mm / 3-inch slip */}
          <div 
            id="kot-printable-ticket"
            className="w-[300px] bg-white text-black p-4 font-mono text-xs shadow-xl rounded-sm print:shadow-none print:w-full print:m-0 print:p-2"
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <h1 className="text-base font-black tracking-tight uppercase">*** KITCHEN ORDER TICKET ***</h1>
              <p className="font-bold text-sm tracking-wide mt-0.5">{ticket.branch_name.toUpperCase()}</p>
              <div className="flex justify-between items-center text-[11px] font-bold mt-1 px-1">
                <span>KOT: #{ticket.kot_number}</span>
                <span className="bg-black text-white px-1.5 py-0.2 rounded text-[10px]">
                  ROUND {ticket.round_number || 1}
                </span>
              </div>
            </div>

            {/* Table & Type Details */}
            <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5 text-[11px]">
              <div className="flex justify-between font-bold text-sm">
                <span>TABLE: {ticket.table_number.toUpperCase()}</span>
                <span className="uppercase text-[11px] px-1 bg-gray-200">{ticket.order_type}</span>
              </div>
              {ticket.section && (
                <div className="text-[10px] text-gray-700">AREA: {ticket.section.toUpperCase()}</div>
              )}
              <div className="flex justify-between text-[10px] text-gray-700 pt-0.5">
                <span>TIME: {ticket.timestamp}</span>
                {ticket.server_name && <span>SRV: {ticket.server_name}</span>}
              </div>
            </div>

            {/* Dishes Checklist */}
            <div className="py-1 mb-2">
              <div className="flex justify-between font-black border-b border-black pb-1 mb-1.5 text-[11px]">
                <span className="w-12">QTY</span>
                <span className="flex-1">ITEM DESCRIPTION</span>
              </div>

              <div className="space-y-2">
                {ticket.items.map((item, idx) => (
                  <div key={idx} className="border-b border-dotted border-gray-300 pb-1.5 last:border-none">
                    <div className="flex items-start">
                      <span className="w-12 font-black text-sm tracking-tight">
                        [{item.quantity}]
                      </span>
                      <span className="flex-1 font-bold text-[12px] leading-snug">
                        {item.name.toUpperCase()}
                      </span>
                    </div>

                    {item.notes && (
                      <div className="ml-12 mt-0.5 font-bold text-[10px] italic text-red-700">
                        &gt;&gt; NOTE: {item.notes.toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Order Special Notes */}
            {ticket.order_notes && (
              <div className="border-2 border-black p-1.5 my-2 text-center bg-gray-50">
                <span className="font-black text-[10px] block text-red-700 uppercase">*** CHEF INSTRUCTION ***</span>
                <p className="font-bold text-[11px] mt-0.5 uppercase leading-tight">
                  {ticket.order_notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t-2 border-black pt-2 text-center text-[10px] space-y-0.5">
              <div className="font-bold">TOTAL DISHES: {ticket.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
              <div className="text-[9px] text-gray-600">ID: {ticket.order_id}</div>
              <div className="text-[8px] pt-1">--- END OF KOT ---</div>
            </div>
          </div>
        </div>

      </div>

      {/* Embedded CSS for Thermal Printer */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #kot-printable-ticket, #kot-printable-ticket * {
            visibility: visible;
          }
          #kot-printable-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
        }
      `}</style>
    </div>
  );
}
