import express from 'express';
import cors from 'cors';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/data', async (req, res) => {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/1z36YOIr9aVnGTu0GuVD63HY-QmOwzY9X/export?format=xlsx';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from Google Sheets');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const data: Record<string, any[]> = {};
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      data[sheetName] = json;
    });

    res.json(data);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, contextData } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'La API Key de Gemini no está configurada en el servidor.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { 
          role: 'user', 
          parts: [{ text: `${prompt}\n\nA continuación te entrego los datos en formato JSON para que los analices:\n${JSON.stringify(contextData).substring(0, 30000)}` }] 
        }
      ]
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || 'Error al comunicarse con Gemini' });
  }
});

export default app;
