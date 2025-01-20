import { NextRequest, NextResponse } from 'next/server';
import { Account, RpcProvider } from 'starknet';
import { supabase } from '~~/lib/supabase';

const provider = new RpcProvider({
    nodeUrl: 'http://localhost:5050',
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, accountAddress, signature, typedData } = body;

        // First get the session to verify against stored data
        const { data: session, error: fetchError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (fetchError || !session) {
            throw new Error('Session not found');
        }

        // Verify the message data matches session data
        if (
            typedData.message.token !== session.session_token ||
            typedData.message.sessionId.join('') !== session.id
        ) {
            throw new Error('Invalid message data');
        }

        // Verify the signature
        const account = new Account(provider, accountAddress, '');
        const isValid = await account.verifyMessage(typedData, signature);

        if (!isValid) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Invalid signature'
                },
                { status: 400 }
            );
        }

        // Update session with verified account address
        const { data, error } = await supabase
            .from('sessions')
            .update({
                account_address: accountAddress,
                status: 'completed'
            })
            .eq('id', sessionId)
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
        console.error('Session update error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update session'
            },
            { status: 400 }
        );
    }
} 