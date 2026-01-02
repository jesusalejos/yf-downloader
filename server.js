import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

app.get('/download', async (req, res) => {
  try {
    const mod = await import('./download.js');
    await mod.main();
    res.json({ ok: true, message: 'Download completed' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
