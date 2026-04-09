import type { TranscriptSegment } from './sarvamBatch';

/** Format seconds as SRT timestamp: HH:MM:SS,mmm */
function toSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':') + ',' + String(ms).padStart(3, '0');
}

/**
 * Build an SRT string from an array of transcript segments.
 * Segments with no timing (start === end === 0) get a 5-second fallback duration.
 */
export function buildSRT(segments: TranscriptSegment[]): string {
  return segments
    .filter((s) => s.text.trim())
    .map((s, i) => {
      const start = s.start;
      const end = s.end > s.start ? s.end : s.start + 5;
      return `${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${s.text}\n`;
    })
    .join('\n');
}
