import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/tmp/omi-output';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { file } = req.query;

  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'File parameter required' });
  }

  try {
    const filePath = path.join(OUTPUT_DIR, path.basename(file));

    // Security: ensure file is in output directory
    if (!filePath.startsWith(OUTPUT_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.mp4') contentType = 'video/mp4';
    if (ext === '.mkv') contentType = 'video/x-matroska';
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.mp3') contentType = 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('Content-Length', fileContent.length);

    return res.send(fileContent);
  } catch (error: any) {
    console.error('Download error:', error.message);
    return res.status(500).json({ error: 'Download failed' });
  }
}
