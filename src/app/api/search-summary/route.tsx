// app/api/generate-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { simpleSearchFlow } from '@/lib/genkit/flows/simpleSearchFlow';
import { researchFlow } from '@/lib/genkit/flows/researchFlow';
import { researchAgentFlow } from '@/lib/genkit/flows/researchAgentFlow';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({
        error: 'Query is required'
      }, { status: 400 });
    }

    // const { summary, docs } = await simpleSearchFlow(query);
    // const { summary, docs } = await researchFlow(query);
    const { summary, docs } = await researchAgentFlow(query);

    return NextResponse.json({
      summary: summary,
      docs: docs,
      status: 'success'
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate summary',
      status: 'error',
      details: process.env.NODE_ENV === 'development' ? {
        errorType: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
      } : undefined
    }, { status: 500 });
  }
}