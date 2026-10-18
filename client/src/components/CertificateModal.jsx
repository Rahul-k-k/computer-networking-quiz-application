import { useState } from 'react';
import { Download, X, Star, Loader2, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';

/** '#rrggbb' | '#rgb' -> [r, g, b] for jsPDF's numeric colour setters. */
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Tier only tints its little chip; the rest of the certificate uses the fixed
// "Geometric Playful" palette below.
const TIER_INK = { Platinum: '#0ea5e9', Gold: '#d97706', Silver: '#64748b', Bronze: '#c2410c' };

// Decorative peach confetti — fixed positions so the preview and re-renders are
// stable (no randomness). Kept clear of the centred text and the corner wedges.
const CONFETTI = [
  { top: '13%', left: '25%', s: 9 },
  { top: '17%', left: '71%', s: 7 },
  { top: '49%', left: '6%', s: 11 },
  { top: '52%', left: '93%', s: 8 },
  { top: '83%', left: '29%', s: 9 },
  { top: '81%', left: '69%', s: 7 },
];

/**
 * A printable "Geometric Playful" certificate. Rendered on a fixed white
 * background (independent of dark mode) so the exported PDF always looks right.
 * The download is drawn as a vector PDF directly with jsPDF — no html2canvas,
 * which chokes on the app's CSS-variable colours and Tailwind gradients.
 */
export default function CertificateModal({ open, onClose, result, userName }) {
  const [busy, setBusy] = useState(false);
  const [dlError, setDlError] = useState('');
  if (!open || !result) return null;

  const tier = result.tier || 'Bronze';
  const tierInk = TIER_INK[tier] || TIER_INK.Bronze;
  const when = new Date(result.createdAt || Date.now());
  const dateStr = when.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // SNA-<year>-<last 6 of the result id>. Gives every certificate a stable,
  // human-quotable identifier tied to the stored attempt.
  const idTail = (String(result._id || '').slice(-6) || 'XXXXXX').toUpperCase();
  const certId = `SNA-${when.getFullYear()}-${idTail}`;

  function download() {
    setBusy(true);
    setDlError('');
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const cx = W / 2;

      const GRAPE = [139, 92, 246];
      const SKY = [125, 211, 252];
      const MINT = [110, 231, 183];
      const YELLOW = [253, 230, 138];
      const PEACH = [247, 158, 147];
      const MUTED = [124, 116, 152];
      const DARK = [36, 30, 64];
      const LINE = [203, 213, 225];
      const tierInkRgb = hexToRgb(tierInk);

      // White page.
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, W, H, 'F');

      // Four geometric corner wedges.
      const T = 42;
      pdf.setFillColor(...GRAPE);
      pdf.triangle(0, 0, T, 0, 0, T, 'F');
      pdf.setFillColor(...SKY);
      pdf.triangle(W, 0, W - T, 0, W, T, 'F');
      pdf.setFillColor(...MINT);
      pdf.triangle(0, H, T, H, 0, H - T, 'F');
      pdf.setFillColor(...YELLOW);
      pdf.triangle(W, H, W - T, H, W, H - T, 'F');

      // Scattered peach confetti (fixed mm coords, clear of the text block).
      pdf.setFillColor(...PEACH);
      [
        [40, 58, 2.2],
        [252, 40, 1.8],
        [26, 150, 2.6],
        [274, 150, 2.0],
        [78, 178, 2.2],
        [214, 182, 1.8],
      ].forEach(([x, y, r]) => pdf.circle(x, y, r, 'F'));

      // Grape ribbon with a star-wrapped title. (Built-in Helvetica can't render
      // ★, so the PDF uses asterisks; the on-screen preview uses real stars.)
      const rw = 124;
      const rh = 15;
      const ry = 26;
      pdf.setFillColor(...GRAPE);
      pdf.roundedRect(cx - rw / 2, ry, rw, rh, 7.5, 7.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('*  CERTIFICATE OF ACHIEVEMENT  *', cx, ry + 9.8, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13);
      pdf.setTextColor(...MUTED);
      pdf.text('This certifies that', cx, 62, { align: 'center' });

      // Recipient name in grape.
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(38);
      pdf.setTextColor(...GRAPE);
      const name = userName || 'Student';
      pdf.text(name, cx, 80, { align: 'center' });

      // Four-segment rainbow underline, centred under the name.
      const nameW = Math.min(W - 60, pdf.getTextWidth(name));
      const segW = nameW / 4;
      const startX = cx - nameW / 2;
      [PEACH, YELLOW, MINT, SKY].forEach((col, i) => {
        pdf.setFillColor(...col);
        pdf.roundedRect(startX + i * segW, 84, Math.max(1, segW - 1.2), 2.4, 1, 1, 'F');
      });

      // Body sentence.
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13);
      pdf.setTextColor(...DARK);
      const sentence = `completed the ${result.categoryName} challenge in SpeedNet Arena`;
      const lines = pdf.splitTextToSize(sentence, W - 90);
      pdf.text(lines, cx, 98, { align: 'center' });

      const y = 98 + lines.length * 6 + 14;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(40);
      pdf.setTextColor(...GRAPE);
      pdf.text(`${result.percentage}%`, cx, y, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(...MUTED);
      pdf.text(`${result.score} / ${result.totalQuestions} correct`, cx, y + 8, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(...tierInkRgb);
      pdf.text(`${tier.toUpperCase()} TIER`, cx, y + 16, { align: 'center' });

      // Footer: date · Program Director (signature line) · Certificate ID.
      const fy = H - 26;
      const colL = 50;
      const colC = cx;
      const colR = W - 50;
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.4);
      pdf.line(colL - 26, fy, colL + 26, fy);
      pdf.line(colC - 28, fy, colC + 28, fy);
      pdf.line(colR - 26, fy, colR + 26, fy);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...DARK);
      pdf.text(dateStr, colL, fy - 2.5, { align: 'center' });
      pdf.text('SpeedNet Arena', colC, fy - 2.5, { align: 'center' });
      pdf.text(certId, colR, fy - 2.5, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      pdf.text('Date', colL, fy + 4, { align: 'center' });
      pdf.text('Program Director', colC, fy + 4, { align: 'center' });
      pdf.text('Certificate ID', colR, fy + 4, { align: 'center' });

      const safeName = (userName || 'student').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      pdf.save(`speednet-certificate-${safeName}.pdf`);
    } catch {
      setDlError('Sorry — the certificate could not be generated. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-pop-in overflow-y-auto">
      <div className="w-full max-w-3xl my-8">
        <div className="flex justify-end mb-3 gap-2">
          <button onClick={download} disabled={busy} className="clay-btn clay-btn-primary">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {busy ? 'Preparing…' : 'Download PDF'}
          </button>
          <button onClick={onClose} className="clay-btn clay-btn-ghost" aria-label="Close">
            <X className="w-5 h-5" /> Close
          </button>
        </div>

        {dlError && (
          <div className="clay-card mb-3 px-4 py-3 text-peach-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" /> {dlError}
          </div>
        )}

        {/* Certificate preview — intentionally white-themed regardless of app theme */}
        <div
          className="relative rounded-[24px] overflow-hidden bg-white text-center px-10 py-12"
          style={{ fontFamily: '"Nunito", sans-serif', color: '#241E40', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        >
          {/* Geometric corner wedges */}
          <span aria-hidden className="absolute" style={{ top: 0, left: 0, width: 84, height: 84, background: '#8B5CF6', clipPath: 'polygon(0 0,100% 0,0 100%)' }} />
          <span aria-hidden className="absolute" style={{ top: 0, right: 0, width: 84, height: 84, background: '#7dd3fc', clipPath: 'polygon(100% 0,0 0,100% 100%)' }} />
          <span aria-hidden className="absolute" style={{ bottom: 0, left: 0, width: 84, height: 84, background: '#6EE7B7', clipPath: 'polygon(0 100%,0 0,100% 100%)' }} />
          <span aria-hidden className="absolute" style={{ bottom: 0, right: 0, width: 84, height: 84, background: '#FDE68A', clipPath: 'polygon(100% 100%,100% 0,0 100%)' }} />

          {/* Confetti dots */}
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute rounded-full"
              style={{ top: c.top, left: c.left, width: c.s, height: c.s, background: '#F79E93', opacity: 0.85 }}
            />
          ))}

          <div className="relative">
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-extrabold tracking-wide"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7dd3fc)', fontFamily: '"Baloo 2", cursive' }}
            >
              <Star className="w-4 h-4 fill-current" /> Certificate of Achievement <Star className="w-4 h-4 fill-current" />
            </div>

            <p className="mt-8 text-slate-500">This certifies that</p>
            <div className="mt-2 inline-block">
              <p className="text-5xl font-extrabold leading-tight" style={{ fontFamily: '"Baloo 2", cursive', color: '#8B5CF6' }}>
                {userName || 'Student'}
              </p>
              <div className="mt-2 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#F79E93,#FDE68A,#6EE7B7,#7dd3fc)' }} />
            </div>

            <p className="mt-6 text-slate-600 max-w-lg mx-auto">
              completed the <strong>{result.categoryName}</strong> challenge in SpeedNet Arena
            </p>
            <p className="mt-4 text-4xl font-extrabold" style={{ fontFamily: '"Baloo 2", cursive', color: '#8B5CF6' }}>
              {result.percentage}%
            </p>
            <p className="text-slate-500 mt-1">
              {result.score} / {result.totalQuestions} correct
            </p>
            <div className="mt-3">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold" style={{ background: '#f3ecff', color: tierInk }}>
                {tier} tier
              </span>
            </div>

            {/* Footer: date · Program Director (signature) · Certificate ID */}
            <div className="mt-10 grid grid-cols-3 gap-4 items-end text-sm text-slate-500 max-w-xl mx-auto">
              <div className="text-center">
                <div className="font-bold text-slate-700">{dateStr}</div>
                <div className="border-t border-slate-300 mt-1 pt-1 text-xs">Date</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-700" style={{ fontFamily: '"Baloo 2", cursive' }}>
                  SpeedNet Arena
                </div>
                <div className="border-t border-slate-300 mt-1 pt-1 text-xs">Program Director</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-700">{certId}</div>
                <div className="border-t border-slate-300 mt-1 pt-1 text-xs">Certificate ID</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
