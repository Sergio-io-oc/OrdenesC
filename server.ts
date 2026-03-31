import express from 'express';
import { google } from 'googleapis';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get('/api/config-check', (req, res) => {
    const hasEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
    const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
    res.json({ 
      configured: hasEmail && hasKey,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL || null,
      missing: [
        !hasEmail && 'GOOGLE_CLIENT_EMAIL',
        !hasKey && 'GOOGLE_PRIVATE_KEY'
      ].filter(Boolean)
    });
  });

  app.get('/api/sheet-headers', async (req, res) => {
    try {
      const { spreadsheetId } = req.query;
      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Missing spreadsheetId' });
      }

      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!clientEmail || !privateKey) {
        return res.status(500).json({ 
          error: 'Google Service Account credentials not configured.' 
        });
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      const sheets = google.sheets({ version: 'v4', auth });
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId as string,
        range: '1:1', // Gets the first row (headers)
      });

      const headers = response.data.values?.[0] || [];
      res.json({ headers });
    } catch (error: any) {
      console.error('Error fetching headers:', error);
      const googleError = error.response?.data?.error?.message || error.message || 'Failed to fetch headers';
      res.status(500).json({ error: googleError });
    }
  });

  app.post('/api/append-sheet', async (req, res) => {
    try {
      const { spreadsheetId, values } = req.body;

      if (!spreadsheetId || !values) {
        return res.status(400).json({ error: 'Missing spreadsheetId or values' });
      }

      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!clientEmail || !privateKey) {
        return res.status(500).json({ 
          error: 'Google Service Account credentials not configured. Please add GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY to secrets.' 
        });
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Ensure values is a 2D array (array of rows)
      const rows = Array.isArray(values[0]) ? values : [values];

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A1', // Appends to the first sheet, starting from A1
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows, // Array of arrays
        },
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Error appending to sheet:', error);
      const googleError = error.response?.data?.error?.message || error.message || 'Failed to append to sheet';
      res.status(500).json({ error: googleError });
    }
  });

  app.post('/api/update-invoice', async (req, res) => {
    try {
      const { spreadsheetId, proveedor, contacto, telefonoEmail, fecha, productos, subtotal, iva, total } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Missing spreadsheetId' });
      }

      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!clientEmail || !privateKey) {
        return res.status(500).json({ 
          error: 'Google Service Account credentials not configured. Please add GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY to secrets.' 
        });
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Clear previous content before writing new data
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: {
          ranges: ['B11', 'B12', 'B13', 'D10', 'A21:D32', 'D33', 'D34', 'D36'],
        },
      });

      const data = [
        { range: 'B11', values: [[proveedor || ""]] },
        { range: 'B12', values: [[contacto || ""]] },
        { range: 'B13', values: [[telefonoEmail || ""]] },
        { range: 'D10', values: [[fecha || ""]] },
        { range: 'D33', values: [[subtotal || ""]] },
        { range: 'D34', values: [[iva || ""]] },
        { range: 'D36', values: [[total || ""]] }
      ];

      // Add products starting from row 21
      if (productos && Array.isArray(productos)) {
        productos.forEach((prod: any, index: number) => {
          const rowIndex = 21 + index;
          if (rowIndex <= 32) { // Limit to row 32
            data.push({
              range: `A${rowIndex}:D${rowIndex}`,
              values: [[
                prod.cantidad || "",
                prod.descripcion || "",
                prod.precioUnit || "",
                prod.precioTotal || ""
              ]]
            });
          }
        });
      }

      const response = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: data,
        },
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      const googleError = error.response?.data?.error?.message || error.message || 'Failed to update invoice';
      res.status(500).json({ error: googleError });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
