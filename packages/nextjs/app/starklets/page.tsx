'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '~~/hooks/useAccount';
import { useScaffoldReadContract } from '~~/hooks/scaffold-stark/useScaffoldReadContract';

type Starklet = {
    address: string;
    name: string;
};

// Helper function to convert decimal to hex address
const toHexAddress = (decimalAddress: string) => {
    // Remove '0x' if present and pad to 64 characters (32 bytes)
    const hex = BigInt(decimalAddress).toString(16).padStart(64, '0');
    return `0x${hex}`;
};

export default function StarkletsPage() {
    const { address, isConnected } = useAccount();
    const [starklets, setStarklets] = useState<Starklet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState<number>(0);

    // Get the count of user's Starklets
    const { data: starkletCount } = useScaffoldReadContract({
        contractName: "StarkletFactory",
        functionName: "get_user_starklets_count",
        args: [address || "0x0"],
        enabled: isConnected && !!address,
    });

    // Get single Starklet address at current index
    const { data: currentStarkletAddress } = useScaffoldReadContract({
        contractName: "StarkletFactory",
        functionName: "get_user_starklet_at",
        args: [address || "0x0", currentIndex],
        enabled: isConnected && !!address && !!starkletCount && currentIndex < Number(starkletCount),
    });

    useEffect(() => {
        console.log('starkletCount', starkletCount);
        
        // Reset state when address changes
        if (!starkletCount || !address) {
            setStarklets([]);
            setCurrentIndex(0);
            setIsLoading(false);
            return;
        }

        // Reset collection when starting fresh
        if (currentIndex === 0) {
            setStarklets([]);
        }

        // Add current Starklet to collection if we have its address
        if (currentStarkletAddress) {
            setStarklets(prev => [...prev, {
                address: toHexAddress(currentStarkletAddress.toString()),
                name: `Starklet #${currentIndex + 1}`,
            }]);

            // Move to next index if there are more Starklets
            if (currentIndex + 1 < Number(starkletCount)) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setIsLoading(false);
            }
        }
    }, [address, starkletCount, currentStarkletAddress, currentIndex]);

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">Please connect your wallet first</div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">Loading your Starklets...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Your Starklets</h1>
            
            {starklets.length === 0 ? (
                <div className="text-center py-8">
                    <p>You don't have any Starklets yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {starklets.map((starklet, index) => (
                        <div 
                            key={starklet.address}
                            className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                        >
                            <h2 className="text-xl font-semibold mb-2">{starklet.name}</h2>
                            <p className="text-sm break-all text-gray-600">
                                Address: {starklet.address}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 