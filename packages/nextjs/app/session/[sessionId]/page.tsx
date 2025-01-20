'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSignTypedData, useProvider } from '@starknet-react/core';
import { SIGNATURE } from '@starknet-io/types-js/dist/types/api/components';
import { useAccount } from '~~/hooks/useAccount';
import { useScaffoldWriteContract } from "~~/hooks/scaffold-stark/useScaffoldWriteContract";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-stark/useScaffoldEventHistory";
import type { GetTransactionReceiptResponse } from "starknet";

// Add custom type for receipt
type StarknetReceipt = {
    block_number: number;
    transaction_hash: string;
    // ... other fields we might need
};

// Add helper function to convert decimal to hex address
const toHexAddress = (decimalAddress: string) => {
    // Remove '0x' if present and pad to 64 characters (32 bytes)
    const hex = BigInt(decimalAddress).toString(16).padStart(64, '0');
    return `0x${hex}`;
};

export default function SessionPage({ params }: { params: { sessionId: string } }) {
    const { address, isConnected } = useAccount();
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [signature, setSignature] = useState<SIGNATURE | null>(null);
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
    const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<{ public_key?: string } | null>(null);
    const [deploymentBlock, setDeploymentBlock] = useState<bigint | undefined>();
    const [watchEvents, setWatchEvents] = useState(false);
    const { provider } = useProvider();

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

    // Change writeAsync to sendAsync
    const { sendAsync: deployStarklet, data: deployStarkletData } = useScaffoldWriteContract({
        contractName: "StarkletFactory",
        functionName: "deploy_starklet",
        args: [{
            owner: address || "0x0",
            public_key: sessionData?.public_key || "0x0",
            name: "Starklet",
            initial_balance: 0n, // TODO: slider from 0 to user's balance
            quote_period: 86400n, // 24 hours in seconds
            quote_limit: 1000000000000000n, // 0.001 ETH in wei
            starklet_address_salt: BigInt(token || "0")
        }],
    });

    // Update event monitoring to use custom triggers
    const { data: deployEvents } = useScaffoldEventHistory({
        contractName: "StarkletFactory",
        eventName: "contracts::StarkletFactory::StarkletFactory::StarkletDeployed",
        fromBlock: deploymentBlock || BigInt(0),
        watch: true,
        enabled: watchEvents,
    });

    // Watch for deployment events and update status
    useEffect(() => {
        if (deployEvents && deployEvents.length > 0) {
            // Get the most recent event
            const latestEvent = deployEvents[0];
            
            // Extract the Starklet address from the event and convert to hex
            const starkletAddress = toHexAddress(latestEvent.args.starklet_address.toString());
            
            // Update state with the deployed address
            setDeployedAddress(starkletAddress);
            setDeploymentStatus('success');
            
            // Stop watching for events
            setWatchEvents(false);
        }
    }, [deployEvents]);

    useEffect(() => {
        const verifySession = async () => {
            try {
                const response = await fetch(
                    `/api/session/verify?sessionId=${params.sessionId}&token=${token}`
                );
                const result = await response.json();
                setIsValid(result.success);
                if (result.success) {
                    setSessionData(result.data); // Store the session data
                }
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

    const handleDeployStarklet = async () => {
        if (!address || !sessionData?.public_key) {
            console.error('No address or public key found');
            console.log('full session data', sessionData);
            return;
        }
        
        setDeploymentStatus('deploying');
        try {
            const data = {
                owner: address,
                public_key: sessionData?.public_key,
                name: "Starklet",
                initial_balance: 0n,
                quote_period: 86400n,
                quote_limit: 1000000000000000n,
                starklet_address_salt: 0n,
            };

            console.log('deploying with data:', data);
            
            const txHash = await deployStarklet({
                args: [data]
            });

            // Wait for transaction to be confirmed and get receipt
            if (txHash && provider) {
                const receipt = await provider.waitForTransaction(txHash) as StarknetReceipt;
                console.log('receipt', receipt);
                if (receipt.block_number) {
                    setDeploymentBlock(BigInt(receipt.block_number));
                    setWatchEvents(true);
                }
            }
            
        } catch (error) {
            console.error('Error deploying Starklet:', error);
            setDeploymentStatus('error');
        }
    };

    const handleSignIn = async () => {
        try {            
            const signature = await signTypedDataAsync();
            setSignature(signature);
            
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
            
            // Automatically trigger Starklet deployment after successful session update
            await handleDeployStarklet();
            
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
                <div className="flex flex-col items-center gap-4">
                    <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        onClick={handleSignIn}
                        disabled={deploymentStatus === 'deploying'}
                    >
                        {deploymentStatus === 'deploying' ? 'Deploying...' : 'Sign in'}
                    </button>
                    
                    {signature && <div>Signature received</div>}
                    
                    {deploymentStatus === 'success' && (
                        <div className="text-green-500">
                            Starklet deployed successfully!
                            {deployedAddress && (
                                <div className="text-sm break-all">
                                    Address: {deployedAddress}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {deploymentStatus === 'error' && (
                        <div className="text-red-500">
                            Error deploying Starklet
                        </div>
                    )}
                    
                    {error && <div className="text-red-500">Error: {error}</div>}
                </div>
            )}
        </div>
    );
} 