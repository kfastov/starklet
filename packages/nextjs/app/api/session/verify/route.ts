import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~~/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');
        const token = searchParams.get('token');

        if (!sessionId || !token) {
            return NextResponse.json(
                { success: false, error: 'Missing sessionId or token' },
                { status: 400 }
            );
        }

        console.time('asking supabase for session');
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('session_token', token)
            .single();

        console.timeEnd('asking supabase for session');

        if (error || !data) {
            return NextResponse.json(
                { success: false, error: 'Invalid session' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error('Session verification error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to verify session' },
            { status: 400 }
        );
    }
} 