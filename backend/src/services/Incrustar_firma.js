// src/services/Incrustar_firma.js
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';

/**
 * Genera un PDF del contrato con la firma incrustada.
 * Devuelve un Buffer con el PDF completo.
 */
function generarPDFConFirma(firmaBase64, datosContrato = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const {
      fullName = '-',
      identification = '-',
      email = '-',
      amount = 0,
      termMonths = 0,
      monthlyPayment = 0,
      interestRateAnnual = 0,
      totalPayment = 0,
      createdAt = new Date().toISOString(),
    } = datosContrato;

    const money = (n) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(
        Math.round(Number(n) || 0)
      );

    // ── Encabezado ──────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('Contrato de Crédito de Consumo', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#555')
      .text(`Generado el: ${new Date(createdAt).toLocaleString('es-CL')}`, { align: 'center' });
    doc.moveDown(1);

    // ── Datos del solicitante ───────────────────────────────────
    doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text('Datos del Solicitante');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica');
    const filas = [
      ['Nombre completo', fullName],
      ['RUT / Identificación', identification],
      ['Email', email],
    ];
    for (const [label, value] of filas) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
    }

    doc.moveDown(1);

    // ── Condiciones del crédito ─────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('Condiciones del Crédito');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica');
    const condiciones = [
      ['Monto solicitado', money(amount)],
      ['Plazo', `${termMonths} meses`],
      ['Cuota mensual', money(monthlyPayment)],
      ['Tasa de interés anual', `${(Number(interestRateAnnual) * 100).toFixed(2)}%`],
      ['Total a pagar', money(totalPayment)],
    ];
    for (const [label, value] of condiciones) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
    }

    doc.moveDown(1);

    // ── Cláusulas ───────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('Cláusulas');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica').fillColor('#333').text(
      'El solicitante declara haber leído y aceptado los términos y condiciones del presente ' +
      'contrato de crédito de consumo. El crédito será desembolsado según los plazos establecidos ' +
      'por la institución financiera. El no pago de las cuotas en las fechas acordadas podrá generar ' +
      'intereses moratorios y acciones de cobranza según la normativa vigente.',
      { align: 'justify' }
    );

    doc.moveDown(2);

    // ── Firma ───────────────────────────────────────────────────
    doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text('Firma del Solicitante');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown(0.5);

    // Incrustar la imagen de la firma desde base64
    const base64Data = firmaBase64.replace(/^data:image\/\w+;base64,/, '');
    const firmaBuffer = Buffer.from(base64Data, 'base64');

    doc.image(firmaBuffer, 50, doc.y, { width: 200, height: 80 });
    doc.moveDown(5);

    doc.fontSize(10).font('Helvetica').fillColor('#555')
      .text(`${fullName}`, 50)
      .text(`${identification}`, 50);

    doc.end();
  });
}

/**
 * Envía el PDF firmado por correo electrónico usando Gmail.
 */
async function enviarPDF(destinatario, pdfBuffer, nombreArchivo = 'contrato_firmado.pdf') {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Banco App'}" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: 'Tu contrato de crédito firmado',
    text: 'Adjunto encontrarás tu contrato de crédito firmado digitalmente.',
    html: `
      <p>Estimado/a cliente,</p>
      <p>Adjunto encontrarás tu contrato de crédito de consumo con tu firma digital.</p>
      <p>Guarda este documento para tus registros.</p>
      <br/>
      <p><strong>${process.env.APP_NAME || 'Banco App'}</strong></p>
    `,
    attachments: [
      {
        filename: nombreArchivo,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/**
 * Orquestador: genera el PDF con la firma y lo envía por email.
 * datosContrato viene del controlador con los datos del crédito.
 */
export async function incrustarFirmaYEnviar(firmaBase64, destinatario, datosContrato = {}) {
  const pdfBuffer = await generarPDFConFirma(firmaBase64, datosContrato);
  await enviarPDF(destinatario, pdfBuffer);
  return 'contrato_firmado.pdf';
}