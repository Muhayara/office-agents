import React from 'react';
import { type AgentView, type Lang, roleLabel } from '@office/shared';
import { gridToIso } from '../isometric/coords';

interface AgentAvatarIsoProps {
  agent: AgentView;
  originX: number;
  originY: number;
  selected: boolean;
  language: Lang;
  onSelect: (agentId: string) => void;
}

export function AgentAvatarIso({
  agent,
  originX,
  originY,
  selected,
  language,
  onSelect,
}: AgentAvatarIsoProps) {
  const pos = gridToIso(agent.desk.x, agent.desk.y, originX, originY);
  const isActive =
    agent.status === 'working' ||
    agent.status === 'thinking' ||
    agent.status === 'messaging';

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={() => onSelect(agent.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-label={`${agent.name} — ${roleLabel(agent.role, language)} (${agent.status})`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(agent.id);
        }
      }}
    >
      {/* Meja kerja isometrik */}
      <polygon
        points="0,-14 24,-2 0,10 -24,-2"
        fill={selected ? '#223841' : '#182A32'}
        stroke={selected ? agent.color : '#31505C'}
        strokeWidth={selected ? 2 : 1.2}
      />

      {/* Indikator monitor kerja di atas meja */}
      <polygon
        points="-8,-18 6,-11 6,-3 -8,-10"
        fill={isActive ? agent.color : '#243B45'}
        opacity={isActive ? 0.9 : 0.65}
      />

      {/* Badan & kepala avatar karakter */}
      <rect
        x={-7}
        y={-32}
        width={14}
        height={16}
        rx={4}
        fill={agent.color}
        stroke="#0F1A1F"
        strokeWidth={1.5}
      />
      <circle
        cx={0}
        cy={-38}
        r={6}
        fill="#EDE8DD"
        stroke={agent.color}
        strokeWidth={2}
      />

      {/* Label nama di bawah meja */}
      <text
        x={0}
        y={22}
        textAnchor="middle"
        fill={selected ? agent.color : '#EDE8DD'}
        fontSize={11}
        fontWeight={600}
        fontFamily="var(--font-sans)"
      >
        {agent.name}
      </text>
    </g>
  );
}
