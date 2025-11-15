const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const admin = require('firebase-admin');
const fs = require('fs'); // Para verificar que el logo existe

// --- FUNCIÓN HELPER: Formato de Moneda ---
// Convierte 1000 en "$1,000.00"
const formatMoney = (amount) => {
  return "$" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// --- CONFIGURACIÓN DE FIREBASE ---
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("Error: No se encontró 'serviceAccountKey.json'. Asegúrate de que esté en esta carpeta.", e);
  process.exit(1); 
}

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS
app.use(cors({ origin: '*' })); 

// --- ENDPOINT: GENERAR REPORTE ---
app.get('/report/sales', async (req, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Ventas_TechNorth.pdf"');

    doc.pipe(res);

    // --- 1. ENCABEZADO Y LOGO ---
    const logoPath = 'technorth.jpeg';
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    } else {
      // Fallback si no hay imagen
      doc.fontSize(18).text('TechNorth', 50, 40);
    }
    
    // Datos de la empresa
    doc.fontSize(10).fillColor('gray');
    doc.text('TechNorth S.A. de C.V.', 400, 50, { align: 'right' });
    doc.text('TNO211101A01', { align: 'right' });
    doc.text('Av. Innovación 123, Apodaca, N.L.', { align: 'right' });
    doc.text('soporte@technorth.mx', { align: 'right' });
    doc.moveDown(2);

    // Título
    doc.fontSize(22).fillColor('#0D47A1').text('Reporte de Ventas', { align: 'center' });
    doc.fontSize(12).fillColor('black').text(`Generado el: ${new Date().toLocaleDateString('es-MX')}`, { align: 'center' });
    doc.moveDown(2);

    // --- 2. DATOS DE FIREBASE ---
    const salesSnapshot = await db.collection('sales').orderBy('timestamp', 'desc').get();
    
    if (salesSnapshot.empty) {
      doc.fontSize(14).text('No se encontraron ventas registradas.', { align: 'center' });
      doc.end();
      return;
    }

    // --- 3. TABLA DE VENTAS ---
    const tableTopY = doc.y; 
    const tableLeftX = 50;
    const tableRightX = 550;

    // Dibuja el fondo gris del encabezado
    doc.rect(tableLeftX, tableTopY, tableRightX - tableLeftX, 20)
       .fillColor('#F0F0F0')
       .fill(); // Solo relleno, sin borde negro grueso

    // Textos del encabezado
    doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
    doc.text('Fecha', 60, tableTopY + 5);
    doc.text('Vendedor', 160, tableTopY + 5);
    doc.text('Subtotal', 360, tableTopY + 5, { width: 80, align: 'right' });
    doc.text('Total', 450, tableTopY + 5, { width: 80, align: 'right' });
    
    // Línea separadora del header
    doc.strokeColor('gray').lineWidth(1)
       .moveTo(tableLeftX, tableTopY + 20)
       .lineTo(tableRightX, tableTopY + 20)
       .stroke();

    doc.moveDown(2.5); // Espacio para empezar los datos
    doc.font('Helvetica');
    
    let totalGeneral = 0;

    // Filas
    for (const saleDoc of salesSnapshot.docs) {
      const sale = saleDoc.data();
      const date = sale.timestamp ? sale.timestamp.toDate().toLocaleDateString('es-MX') : 'N/A';
      const employee = sale.employee_email ? sale.employee_email.split('@')[0] : 'N/A';
      const subtotal = sale.subtotal || 0;
      const total = sale.total || 0;
      totalGeneral += total;

      // Control de salto de página (simple)
      if (doc.y > 750) {
        doc.addPage();
        doc.moveDown();
      }

      const y = doc.y;
      doc.fontSize(9).fillColor('black');
      doc.text(date, 60, y);
      doc.text(employee, 160, y, { width: 200, lineBreak: false });
      doc.text(formatMoney(subtotal), 360, y, { width: 80, align: 'right' });
      doc.text(formatMoney(total), 450, y, { width: 80, align: 'right' });
      doc.moveDown();
    }
    
    // --- 4. TOTAL FINAL (Alineado Perfecto) ---
    doc.moveDown(0.5);
    const tableFooterY = doc.y;
    
    // Línea negra final
    doc.strokeColor('black').lineWidth(1)
       .moveTo(tableLeftX, tableFooterY)
       .lineTo(tableRightX, tableFooterY)
       .stroke();

    doc.moveDown(1); // Un poco de aire

    // ✅ EL FIX: Guardamos la Y para que queden en la misma línea horizontal
    const finalY = doc.y; 

    doc.font('Helvetica-Bold').fontSize(12);
    // Etiqueta
    doc.text('Total General:', 360, finalY, { width: 80, align: 'right' });
    // Valor
    doc.text(formatMoney(totalGeneral), 450, finalY, { width: 80, align: 'right' });
    
    doc.end();

  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).send("Error al generar el reporte: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servicio de Reportes corriendo en puerto ${PORT}`);
});
