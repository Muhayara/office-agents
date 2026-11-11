import React from 'react';
import { type AgentView, type GatewayStatus, type Lang, roleLabel } from '@office/shared';

interface CommandComposerProps {
  agents: AgentView[];
  target: string;
  draft: string;
  language: Lang;
  gatewayStatus: GatewayStatus;
  onChangeTarget: (target: string) => void;
  onChangeDraft: (draft: string) => void;
  onSend: () => void;
}

export const CommandComposer: React.FC<CommandComposerProps> = ({
  agents,
  target,
  draft,
  language,
  gatewayStatus,
  onChangeTarget,
  onChangeDraft,
  onSend,
}) => {
  const isOffline = gatewayStatus === 'offline';

  return (
    <form
      className="composer-bar"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isOffline) onSend();
      }}
    >
      <label className="sr-only" htmlFor="composer-target">
        {language === 'id' ? 'Tujuan Perintah' : 'Command Target'}
      </label>
      <select
        id="composer-target"
        className="composer-target"
        value={target}
        onChange={(e) => onChangeTarget(e.target.value)}
      >
        <option value="manager">
          → Raka ({language === 'id' ? 'Manajer' : 'Manager'})
        </option>
        <option value="all">
          → {language === 'id' ? 'Semua (Siaran)' : 'All (Broadcast)'}
        </option>
        {agents
          .filter((a) => a.id !== 'raka')
          .map((a) => (
            <option key={a.id} value={a.id}>
              → {a.name.split(' ')[0] ?? a.name} ({roleLabel(a.role, language)})
            </option>
          ))}
      </select>

      <label className="sr-only" htmlFor="composer-input">
        {language === 'id' ? 'Perintah CEO' : 'CEO Instruction'}
      </label>
      <input
        id="composer-input"
        type="text"
        className="composer-input"
        disabled={isOffline}
        value={draft}
        onChange={(e) => onChangeDraft(e.target.value)}
        placeholder={
          isOffline
            ? language === 'id'
              ? 'Gateway offline — tidak dapat mengirim perintah'
              : 'Gateway offline — cannot send command'
            : language === 'id'
              ? 'Tulis instruksi CEO untuk kantor (Tekan Enter untuk kirim)...'
              : 'Type CEO instruction for the office (Press Enter to send)...'
        }
      />

      <button
        type="submit"
        className="composer-submit"
        disabled={isOffline || draft.trim().length === 0}
      >
        {language === 'id' ? 'Kirim ↵' : 'Send ↵'}
      </button>
    </form>
  );
};
