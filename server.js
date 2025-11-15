const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const admin = require('firebase-admin');
const fs = require('fs'); // Para verificar que el logo existe

// --- ✅ NUEVO: Función para formatear moneda ---
// Esto agrega las comas (ej: $96,818.71)
const formatMoney = (amount) => {
  return "$" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
// ------------------------------------------

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
    const tableTopY = doc.y; // Guardamos la posición Y
    const tableLeftX = 50;
    const tableRightX = 550;

    // ✅ MEJORA: Encabezado de tabla con fondo
    doc.rect(tableLeftX, tableTopY, tableRightX - tableLeftX, 20) // (x, y, ancho, alto)
       .fillColor('#F0F0F0') // Gris claro de fondo
       .strokeColor('gray')
       .fillAndStroke();
    
    doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
    doc.text('Fecha', 60, tableTopY + 5);
    doc.text('Vendedor', 160, tableTopY + 5);
    doc.text('Subtotal', 360, tableTopY + 5, { width: 80, align: 'right' });
    doc.text('Total', 450, tableTopY + 5, { width: 80, align: 'right' });
    doc.moveDown(2); // Espacio después del header

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

      const y = doc.y + 5; // Damos un poco de padding
      doc.fontSize(9).text(date, 60, y);
      doc.text(employee, 160, y, { width: 200 });
      // ✅ MEJORA: Usamos la función formatMoney
      doc.text(formatMoney(subtotal), 360, y, { width: 80, align: 'right' });
      doc.text(formatMoney(total), 450, y, { width: 80, align: 'right' });
      doc.moveDown();
    }
    
    // --- 4. Total Final ---
    const tableFooterY = doc.y + 10;
    doc.moveTo(tableLeftX, tableFooterY).lineTo(tableRightX, tableFooterY).strokeColor('black').stroke();
    doc.moveDown(1.5);
    
    // ✅ MEJORA: Alineación profesional del Total
    doc.font('Helvetica-Bold').fontSize(12);
    // Ponemos el texto "Total General:" alineado a la derecha, bajo la columna "Subtotal"
    doc.text('Total General:', 360, doc.y, { width: 80, align: 'right' });
    // Ponemos el número final alineado a la derecha, bajo la columna "Total"
    doc.text(formatMoney(totalGeneral), 450, doc.y, { width: 80, align: 'right' });
    
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
