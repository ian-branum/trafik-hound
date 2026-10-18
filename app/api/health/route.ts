import { NextResponse } from 'next/server';
import getDriver from '@/lib/neo4j';

export async function GET() {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run('RETURN 1 AS ping, datetime() AS now');
    const record = result.records[0];
    return NextResponse.json({
      status: 'ok',
      neo4j: 'connected',
      dbTime: record.get('now').toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { status: 'error', neo4j: 'unreachable', message },
      { status: 503 }
    );
  } finally {
    await session.close();
  }
}
