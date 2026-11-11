import React from 'react';
import type { AgentView, Lang } from '@office/shared';
import {
  ISO_GRID_COLS,
  ISO_GRID_ROWS,
  OFFICE_ZONES,
  computeDepthKey,
  gridToIso,
} from '../isometric/coords';
import { AgentAvatarIso } from '../sprites/AgentAvatarIso';

interface IsometricOfficeStageProps {
  agents: AgentView[];
  selectedAgentId: string;
  language: Lang;
  onSelectAgent: (agentId: string) => void;
}

export function IsometricOfficeStage({
  agents,
  selectedAgentId,
  language,
  onSelectAgent,
}: IsometricOfficeStageProps) {
  const originX = 420;
  const originY = 110;

  const tiles: Array<{ col: number; row: number; zoneAccent?: string }> = [];
  for (let row = 0; row < ISO_GRID_ROWS; row += 1) {
    for (let col = 0; col < ISO_GRID_COLS; col += 1) {
      const zone = OFFICE_ZONES.find(
        (z) =>
          col >= z.minCol &&
          col <= z.maxCol &&
          row >= z.minRow &&
          row <= z.maxRow,
      );
      tiles.push({ col, row, zoneAccent: zone?.accentColor });
    }
  }

  const sortedAgents = [...agents].sort(
    (a, b) =>
      computeDepthKey(a.desk.x, a.desk.y, 1) -
      computeDepthKey(b.desk.x, b.desk.y, 1),
  );

  return (
    <section
      aria-label={
        language === 'id'
          ? 'Panggung Ruang Kantor Isometrik 2.5D'
          : '2.5D Isometric Office Stage'
      }
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-paper)',
        borderRight: '1px solid var(--color-rule)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-rule)',
          background: 'var(--color-paper-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14 }}>
            {language === 'id'
              ? 'Lantai Kantor Virtual 2.5D (Fondasi Fase A)'
              : '2.5D Virtual Office Floor (Phase A Foundation)'}
          </strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {ISO_GRID_COLS}×{ISO_GRID_ROWS} iso-grid · {agents.length} kursi
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {OFFICE_ZONES.map((z) => (
            <span
              key={z.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--color-ink-2)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: z.accentColor,
                  display: 'inline-block',
                }}
              />
              <span>{language === 'id' ? z.labelId : z.labelEn}</span>
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        <svg
          viewBox="0 0 840 460"
          style={{ width: '100%', height: '100%', maxHeight: 620 }}
          role="img"
          aria-label="Isometric Office Floorplan"
        >
          {/* Petak Lantai Isometrik */}
          {tiles.map((t) => {
            const p = gridToIso(t.col, t.row, originX, originY);
            const isChecker = (t.col + t.row) % 2 === 0;
            return (
              <g key={`${t.col}_${t.row}`} transform={`translate(${p.x}, ${p.y})`}>
                <polygon
                  points="0,-16 32,0 0,16 -32,0"
                  fill={isChecker ? '#14232A' : '#172830'}
                  stroke={t.zoneAccent ?? '#243B45'}
                  strokeOpacity={t.zoneAccent ? 0.45 : 0.8}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Kursi & Avatar 10 Agen (diurutkan dengan depth sorting row + col) */}
          {sortedAgents.map((agent) => (
            <AgentAvatarIso
              key={agent.id}
              agent={agent}
              originX={originX}
              originY={originY}
              selected={agent.id === selectedAgentId}
              language={language}
              onSelect={onSelectAgent}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
