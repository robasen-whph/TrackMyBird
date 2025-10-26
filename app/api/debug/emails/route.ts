import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// DEBUG ENDPOINT - Only for development/testing
// Disabled in production for security

export async function GET() {
  // Only allow in development or when explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_EMAILS !== 'true') {
    return NextResponse.json(
      { error: 'Debug endpoint disabled in production' },
      { status: 403 }
    );
  }

  try {
    const mailDir = '/tmp/mails';
    
    // Check if directory exists
    try {
      await fs.access(mailDir);
    } catch {
      return NextResponse.json({ emails: [] });
    }

    // Read all .eml files
    const files = await fs.readdir(mailDir);
    const emlFiles = files.filter(f => f.endsWith('.eml'));

    // Read contents of each file
    const emails = await Promise.all(
      emlFiles.map(async (filename) => {
        const filepath = path.join(mailDir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        
        // Extract verification token from content
        const match = content.match(/\/api\/auth\/verify\?token=([a-f0-9]+)/);
        const token = match ? match[1] : null;
        
        return {
          filename,
          content,
          token,
          timestamp: parseInt(filename.split('-')[0], 10),
        };
      })
    );

    // Sort by timestamp descending (newest first)
    emails.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('[debug/emails] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read emails' },
      { status: 500 }
    );
  }
}
