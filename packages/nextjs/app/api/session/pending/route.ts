import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~~/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountAddress = searchParams.get('accountAddress');

        if (!accountAddress) {
            return NextResponse.json(
                { success: false, error: 'Missing accountAddress parameter' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('account_address', accountAddress)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json(
            {
                success: true,
                data: data
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Fetch pending sessions error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch pending sessions'
            },
            { status: 400 }
        );
    }
} 