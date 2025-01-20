import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '~~/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fullPublicKey, sessionToken, signature, publicKey } = body;

        // Insert the session data into Supabase
        const { data, error } = await supabase
            .from('sessions')
            .insert([
                {
                    public_key: publicKey,
                    full_public_key: fullPublicKey,
                    session_token: sessionToken,
                    signature_r: signature.r,
                    signature_s: signature.s,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(
            { 
                success: true,
                data: data
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Session creation error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: 'Failed to create session'
            },
            { status: 400 }
        );
    }
} 