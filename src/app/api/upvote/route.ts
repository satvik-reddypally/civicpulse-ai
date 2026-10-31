import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing grievance ID' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('grievances')
      .select('upvotes')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
    }

    const newUpvotes = (existing.upvotes || 1) + 1;

    const { data: updated, error: updateErr } = await supabase
      .from('grievances')
      .update({ upvotes: newUpvotes })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ grievance: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upvote error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}