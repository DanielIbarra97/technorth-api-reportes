const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const admin = require('firebase-admin');
const fs = require('fs'); // Para verificar que el logo existe

// Carga tus credenciales de Firebase
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("Error: No se encontró 'serviceAccountKey.json'. Asegúrate de que esté en esta carpeta.", e);
  process.exit(1); // Detener la app si no hay llave
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3001; // Usaremos el puerto 3001

// Configurar CORS para permitir que tu app de Flutter se conecte
app.use(cors({ origin: '*' })); // Permitir todas las conexiones por ahora

// --- Endpoint CU5: Generar Reporte de Ventas ---
app.get('/report/sales', async (req, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Configurar la respuesta HTTP para que el navegador descargue el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Ventas_TechNorth.pdf"');

    // Pipe (conectar) el PDF directamente a la respuesta
    doc.pipe(res);

    // --- 1. Encabezado y Logo (Como pide el requisito) ---
    const logoPath = 'technorth.jpeg';
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    } else {
      console.log("No se encontró el logo, continuando sin él.");
      doc.text('TechNorth', 50, 40, {width: 100});
    }
    
    // Datos de la empresa (los que definimos)
    doc.fontSize(10).fillColor('gray').text('TechNorth S.A. de C.V.', 400, 50, { align: 'right' });
    doc.text('TNO211101A01', { align: 'right' });
    doc.text('Av. Innovación 123, Apodaca, N.L.', { align: 'right' });
    doc.text('soporte@technorth.mx', { align: 'right' });
    doc.moveDown(2);

    // Título del Reporte
    doc.fontSize(22).fillColor('#0D47A1').text('Reporte de Ventas', { align: 'center' }); // Azul
    doc.fontSize(12).fillColor('black').text(`Generado el: ${new Date().toLocaleDateString('es-MX')}`, { align: 'center' });
    doc.moveDown(2);

    // --- 2. Obtener Datos de Ventas (Firestore - NoSQL) ---
    const salesSnapshot = await db.collection('sales').orderBy('timestamp', 'desc').get();
    
    if (salesSnapshot.empty) {
      doc.fontSize(14).text('No se encontraron ventas registradas.', { align: 'center' });
      doc.end();
      return;
    }

    // --- 3. Formato de Tabla (Aceptable a la vista) ---
    let y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    // Encabezados de tabla
    doc.text('Fecha', 60, y);
    doc.text('Vendedor', 160, y);
    doc.text('Subtotal', 360, y, { width: 80, align: 'right' });
    doc.text('Total', 450, y, { width: 80, align: 'right' });
    doc.moveDown();
    const tableHeaderY = doc.y;
    doc.moveTo(50, tableHeaderY).lineTo(550, tableHeaderY).strokeColor('gray').stroke();

    doc.font('Helvetica');
    let totalGeneral = 0;

    // Filas de la tabla
    for (const saleDoc of salesSnapshot.docs) {
      const sale = saleDoc.data();
      const date = sale.timestamp ? sale.timestamp.toDate().toLocaleDateString('es-MX') : 'N/A';
      const employee = sale.employee_email ? sale.employee_email.split('@')[0] : 'N/A';
      const subtotal = sale.subtotal || 0;
      const total = sale.total || 0;
      totalGeneral += total;

      y = doc.y + 10;
      doc.fontSize(9).text(date, 60, y);
      doc.text(employee, 160, y, { width: 200 });
      doc.text(`$${subtotal.toFixed(2)}`, 360, y, { width: 80, align: 'right' });
      doc.text(`$${total.toFixed(2)}`, 450, y, { width: 80, align: 'right' });
      doc.moveDown();
    }
    
    // --- 4. Total Final ---
    const tableFooterY = doc.y + 10;
    doc.moveTo(50, tableFooterY).lineTo(550, tableFooterY).strokeColor('black').stroke();
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total General:', 340, doc.y);
    doc.text(`$${totalGeneral.toFixed(2)}`, 450, doc.y, { width: 80, align: 'right' });
    
    // Finalizar el PDF
    doc.end();

  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).send("Error al generar el reporte: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servicio de Reportes (Node.js) corriendo en http://localhost:${PORT}`);
});