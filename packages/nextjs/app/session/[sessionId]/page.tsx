'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSignTypedData } from '@starknet-react/core';
import { SIGNATURE } from '@starknet-io/types-js/dist/types/api/components';
import { useAccount } from '~~/hooks/useAccount';

export default function SessionPage({ params }: { params: { sessionId: string } }) {
    const { address, isConnected } = useAccount();
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [signature, setSignature] = useState<SIGNATURE | null>(null);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    // Split UUID into chunks of 31 characters or less
    const sessionIdChunks = params.sessionId.match(/.{1,31}/g) || [];

    const typedData = {
        message: {
            sessionId: sessionIdChunks,
            token: token || '',
            timestamp: Math.floor(Date.now() / 1000).toString(),
        },
        types: {
            StarkNetDomain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'string' },
            ],
            Session: [
                { name: 'sessionId', type: 'string*' },
                { name: 'token', type: 'string' },
                { name: 'timestamp', type: 'string' },
            ],
        },
        primaryType: 'Session',
        domain: {
            name: 'Starklet',
            version: '1',
            chainId: 'SN_SEPOLIA',
        },
    };

    const { signTypedDataAsync } = useSignTypedData({
        params: typedData
    });

    useEffect(() => {
        const verifySession = async () => {
            try {
                const response = await fetch(
                    `/api/session/verify?sessionId=${params.sessionId}&token=${token}`
                );
                const result = await response.json();
                setIsValid(result.success);
            } catch (error) {
                console.error('Error verifying session:', error);
                setIsValid(false);
            } finally {
                setIsLoading(false);
            }
        };

        if (token) {
            verifySession();
        } else {
            setIsValid(false);
            setIsLoading(false);
        }
    }, [params.sessionId, token]);

    // if (isLoading) {
    //     return (
    //         <div className="flex items-center justify-center min-h-screen">
    //             <div className="text-xl">Verifying session...</div>
    //         </div>
    //     );
    // }

    // if (!isValid) {
    //     return (
    //         <div className="flex items-center justify-center min-h-screen">
    //             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
    //                 Invalid session or token
    //             </div>
    //         </div>
    //     );
    // }

    const handleSignIn = async () => {
        try {            
            const signature = await signTypedDataAsync();
            setSignature(signature);
            
            // Update the session with the account address and signature
            const response = await fetch('/api/session/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: params.sessionId,
                    accountAddress: address,
                    signature: signature,
                    typedData: typedData
                }),
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to update session');
            }

            setError(null);
            console.log('Session updated with account address');
        } catch (e) {
            console.error('Error during sign in:', e);
            setError('Error during sign in');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            {!isConnected ? (
                <div className="text-center">
                    <div className="mb-4">Please connect your wallet first</div>
                </div>
            ) : (
                <>
                    <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        onClick={handleSignIn}
                    >
                        Sign in
                    </button>
                    {signature && <div>Signature received</div>}
                    {error && <div>Error: {error}</div>}
                </>
            )}
        </div>
    );
} 