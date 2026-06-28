import express from 'express';
import multer from 'multer';
import vision from '@google-cloud/vision';
import { attachUser } from '../middlewares/auth.js';
import { saveProcessedDocument } from '../db/repositories/document.repository.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Inicializa cliente Vision (usa GOOGLE_APPLICATION_CREDENTIALS del .env)
const client = new vision.ImageAnnotatorClient();

// ---------------- Helpers: RUT y Nombre ----------------
function calculateRutDv(res) {
  if (res === 11) return '0';
  if (res === 10) return 'K';
  return String(res);
}

function formatRutBody(body) {
  const groups = [];
  for (let end = body.length; end > 0; end -= 3) {
    const start = Math.max(0, end - 3);
    groups.unshift(body.slice(start, end));
  }
  return groups.join('.');
}

function isValidRut(body, dv) {
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const dvCalc = calculateRutDv(res);
  return dvCalc === dv.toUpperCase();
}

function findRutInfo(rawText = '') {
  const lines = rawText.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  const joinedNoDots = lines.join('\n').replace(/\./g, '');

  // Candidatos: 7-8 dígitos + DV con módulo 11 correcto
  const all = [...joinedNoDots.matchAll(/(\d{7,8})-([0-9kK])/g)]
    .map(m => ({ body: m[1], dv: m[2].toUpperCase(), idx: m.index ?? 0 }));

  // Índices de líneas donde aparecen tokens de contexto
  const ctx = lines.map(l => l.toUpperCase());
  const hasTokenNear = (lineIdx, tokenSet, radius = 2) => {
    const from = Math.max(0, lineIdx - radius);
    const to = Math.min(ctx.length - 1, lineIdx + radius);
    for (let i = from; i <= to; i++) {
      for (const t of tokenSet) if (ctx[i].includes(t)) return true;
    }
    return false;
  };

  // Ubica la línea de cada candidato
  const locateCandidateLine = (body, dv) => {
    const raw = `${body}-${dv}`;
    const noDots = raw; // ya sin puntos
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/\./g, '').includes(noDots)) return i;
    }
    return -1;
  };

  const GOOD = new Set(['RUN', 'RUT']);
  const BAD  = new Set(['DOCUMENTO', 'DOC.', 'N°', 'NO.', 'NUMERO', 'NÚMERO']);

  // Scoring
  const scored = [];
  for (const c of all) {
    if (!isValidRut(c.body, c.dv)) continue;
    const lineIdx = locateCandidateLine(c.body, c.dv);
    let score = 0;
    if (lineIdx >= 0) {
      if (hasTokenNear(lineIdx, GOOD, 2)) score += 5;
      if (hasTokenNear(lineIdx, BAD, 2))  score -= 5;
    }
    // preferir cuerpos de 8 dígitos a 7
    if (c.body.length === 8) score += 1;
    scored.push({ ...c, lineIdx, score });
  }

  if (!scored.length) return { rut: '', index: -1, lines };

  // mejor candidato
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const withDots = formatRutBody(best.body);
  const rut = `${withDots}-${best.dv}`;
  return { rut, index: best.lineIdx, lines };
}


function guessFullName(rawText = '', hintIndex = -1, linesArg) {
  // 1) normaliza
  const lines = (linesArg ?? rawText.split(/\r?\n+/))
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map(s => s.toUpperCase());

  const STOP = new Set([
    'CHILE','CÉDULA','DE','IDENTIDAD','REPÚBLICA','SERVICIO','REGISTRO','CIVIL','E','IDENTIFICACIÓN',
    'FIRMA','DEL','TITULAR','SEXO','NACIONALIDAD','FECHA','NACIMIENTO','VÁLIDA','HASTA','EMISIÓN',
    'RUN','RUT','Nº','N°','NUMERO','NÚMERO','DOCUMENTO','CARNET','CI','CEDULA','IDENTIFICACION','PAIS','PAÍS'
  ]);
  const LABELS = ['APELLIDOS','APELLIDO','NOMBRES','NOMBRE'];
  const NOISE_WORDS = /(CH?I?LE|HILE|CHECHILE|CLILE)/;

  const cleanTokens = (txt) =>
    txt.split(' ')
      .filter(w => w && !STOP.has(w) && !LABELS.includes(w) && !NOISE_WORDS.test(w))
      .join(' ')
      .trim();

  const isNameLike = (l) => {
    if (!l || /\d/.test(l) || l.length < 2) return false;
    const kept = cleanTokens(l);
    return kept.length >= 2; // al menos 2 letras tras limpieza
  };

  const getAfter = (label) => {
    const idx = lines.findIndex(l => l.replace(/\s+/g,' ') === label);
    if (idx === -1) return '';
    const collected = [];
    for (let i = idx + 1; i < Math.min(lines.length, idx + 3); i++) {
      if (isNameLike(lines[i])) collected.push(cleanTokens(lines[i]));
    }
    return collected.join(' ').trim();
  };

  // 2) estrategia principal: usar rótulos
  const apellidos = getAfter('APELLIDOS') || getAfter('APELLIDO');
  const nombres   = getAfter('NOMBRES')   || getAfter('NOMBRE');

  if (nombres && apellidos) {
    let out = `${nombres} ${apellidos}`.replace(/\b(APELLIDOS?|NOMBRES?)\b/g, '').replace(/\s+/g,' ').trim();
    return out;
  }
  if (nombres) {
    return nombres.replace(/\b(APELLIDOS?|NOMBRES?)\b/g, '').replace(/\s+/g,' ').trim();
  }
  if (apellidos) {
    return apellidos.replace(/\b(APELLIDOS?|NOMBRES?)\b/g, '').replace(/\s+/g,' ').trim();
  }

  // 3) fallback: ventana alrededor del RUT
  if (typeof hintIndex === 'number' && hintIndex >= 0) {
    const from = Math.max(0, hintIndex - 4);
    const to   = Math.min(lines.length - 1, hintIndex + 4);
    const cands = [];
    for (let i = from; i <= to; i++) {
      if (isNameLike(lines[i])) cands.push({ idx: i, txt: cleanTokens(lines[i]) });
    }
    if (cands.length) {
      cands.sort((a,b) => a.idx - b.idx);
      // une contiguas
      let merged = cands[0].txt;
      for (let i = 1; i < cands.length; i++) {
        if (cands[i].idx === cands[i-1].idx + 1) merged += ' ' + cands[i].txt;
      }
      return merged.replace(/\b(APELLIDOS?|NOMBRES?)\b/g, '').replace(/\s+/g,' ').trim();
    }
  }

  // 4) último recurso: mejores candidatas globales
  const all = lines.map(l => (isNameLike(l) ? cleanTokens(l) : '')).filter(Boolean);
  return all.join(' ').replace(/\b(APELLIDOS?|NOMBRES?)\b/g, '').replace(/\s+/g,' ').trim();
}




// ---------------- Endpoint: /api/ocr ----------------
router.post('/ocr', attachUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // Google Vision OCR
    const [result] = await client.textDetection({ image: { content: req.file.buffer } });
    const rawText = result?.fullTextAnnotation?.text || '';

    // Post-procesamiento
    const { rut: identification, index: rutIndex, lines } = findRutInfo(rawText);
    const fullName = guessFullName(rawText, rutIndex, lines);

    let linesDbg = [];
    if (typeof rutIndex === 'number' && rutIndex >= 0 && Array.isArray(lines)) {
      const from = Math.max(0, rutIndex - 3);
      const to = Math.min(lines.length - 1, rutIndex + 3);
      linesDbg = lines.slice(from, to + 1);
    }
    console.log('[OCR window]', { rutIndex, linesDbg });

    const payload = { identification, fullName, rawText, linesDbg };

    if (req.user?.id) {
      await saveProcessedDocument({
        userId: req.user.id,
        documentType: 'identity',
        rawText,
        extractedData: {
          documentType: 'identity',
          fields: { identification, fullName },
        },
        source: 'google_vision_ocr',
      });
    }

    return res.json(payload);
  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ error: 'Error procesando la imagen' });
  }
});

export default router;
