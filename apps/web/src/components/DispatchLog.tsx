import React, { useEffect, useRef } from 'react';
import type { AgentView, Lang, MessageKind } from '@office/shared';
import { formatTimeShort } from '../lib/i18n';

export interface FeedItem {
  id: string;
  at: string;
  kind: 'message' | 'say' | 'system' | 'approval';
  sender: string;
  recipient?: string;
  body: string;
  messageKind?: MessageKind;
}

interface DispatchLogProps {
  items: FeedItem[];
  agents: AgentView[];
  language: Lang;
  filterAgentId: string | null;
  onClearFilter: () => void;
  onQuickPrompt: (text: string) => void;
}

export const DispatchLog: React.FC<DispatchLogProps> = ({
  items,
  agents,
  language,
  filterAgentId,
  onClearFilter,
  onQuickPrompt,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const visibleItems = filterAgentId
    ? items.filter((it) => it.sender === filterAgentId || it.recipient === filterAgentId)
    : items;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleItems.length]);

  const senderDisplay = (id: string) => {
    if (id === 'ceo') return { label: 'CEO', color: 'var(--signal)' };
    if (id === 'system') return { label: 'SYSTEM', color: 'var(--text-muted)' };
    const ag = agentMap.get(id);
    if (ag) return { label: (ag.name.split(' ')[0] ?? ag.name).toUpperCase(), color: ag.color };
    return { label: id.toUpperCase(), color: 'var(--text-muted)' };
  };

  const quickExamples = [
    'Buat aplikasi kalkulator pajak PPh 21 sederhana (HTML + JS + tes unit)',
    'Susun landing page produk kopi Nusantara + uji validasi form pesanan',
    'Buat modul CLI konversi mata uang IDR/USD dengan tes node:test',
  ];

  return (
    <section className="dispatch-feed" aria-label="Aliran Pesan & Log Aktivitas">
      <div className="section-header">
        <span>
          {language === 'id' ? 'Aliran Pesan & Aktivitas Kantor' : 'Office Message & Activity Feed'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {filterAgentId && (
            <button
              type="button"
              onClick={onClearFilter}
              className="mono"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--line-strong)',
                color: 'var(--text-primary)',
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              Filter: @{filterAgentId} ×
            </button>
          )}
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {visibleItems.length} entri
          </span>
        </div>
      </div>

      <div className="dispatch-feed-list" ref={scrollRef}>
        {visibleItems.length === 0 ? (
          <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ marginBottom: 10, color: 'var(--text-primary)', fontWeight: 600 }}>
              {language === 'id'
                ? 'Kantor siap. Ketik perintah untuk Raka di bawah — mis. "Buat aplikasi kalkulator pajak sederhana".'
                : 'Office ready. Send an instruction to Raka below.'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {language === 'id' ? 'Contoh perintah cepat:' : 'Quick start prompts:'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {quickExamples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => onQuickPrompt(ex)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--line)',
                    borderLeft: '2px solid var(--signal)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: 2,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  → {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleItems.map((item) => {
            const s = senderDisplay(item.sender);
            const r = item.recipient ? senderDisplay(item.recipient) : null;
            return (
              <div key={item.id} className="feed-item">
                <span className="feed-time">{formatTimeShort(item.at)}</span>
                <span className="feed-sender" style={{ color: s.color }}>
                  {s.label}
                  {r ? (
                    <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                      {' '}
                      → {r.label}
                    </span>
                  ) : null}
                </span>
                <div className="feed-body">
                  {item.kind === 'say' ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      “{item.body}”
                    </span>
                  ) : (
                    item.body
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
