import { stark, ec, encode, hash, BigNumberish } from 'starknet';
import open from 'open';
import deployedContracts from '@ss-2/nextjs/contracts/deployedContracts';

const STARKLET_FACTORY_ADDRESS = deployedContracts.devnet.StarkletFactory.address;

const STARKLET_CLASS_HASH = '0x6a21c389449dcef09f322e93d646f8f2672f12ce4f9a4463ab2280b211d1e1e';

const waitForSessionCompletion = async (sessionId: string, sessionToken: string, maxAttempts = 60) => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const response = await fetch(`http://localhost:3000/api/session/verify?sessionId=${sessionId}&token=${sessionToken}`);
        const result = await response.json();
        
        if (result.success && result.data.status === 'completed' && result.data.account_address) {
            return result.data.account_address;
        }
        
        await delay(2000); // Wait 2 seconds between attempts
        attempts++;
    }
    
    throw new Error('Session timed out waiting for account address');
};

const main = async () => {
    const privateKey = stark.randomAddress();
    console.log('PRIVATE_KEY=', privateKey);
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
    console.log('PUBLIC_KEY=', starkKeyPub);
    const fullPublicKey = encode.addHexPrefix(
        encode.buf2hex(ec.starkCurve.getPublicKey(privateKey, false))
    );
    console.log('FULL_PUBLIC_KEY=', fullPublicKey);
    const sessionToken = stark.randomAddress();
    console.log('SESSION_TOKEN=', sessionToken);

    // Signing the session token with the private key
    const signature = ec.starkCurve.sign(sessionToken, privateKey);
    console.log('SESSION_TOKEN_SIGNATURE=', signature);

    console.log('Sending full public key, session token and signature to the server...');

    // Send data to the server
    const response = await fetch('http://localhost:3000/api/session/new', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fullPublicKey,
            sessionToken,
            signature: {
                r: signature.r.toString(),
                s: signature.s.toString(),
            },
            publicKey: starkKeyPub,
        })
    });

    const result = await response.json();

    if (result.success) {
        const sessionId = result.data.id;
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const sessionUrl = `${appUrl}/session/${sessionId}?token=${sessionToken}`;
        console.log('Opening session URL:', sessionUrl);
        await open(sessionUrl);

        console.log('Waiting for account authorization...');
        try {
            const accountAddress = await waitForSessionCompletion(sessionId, sessionToken);
            console.log('ACCOUNT_ADDRESS=', accountAddress);
            const starkletAddress = computeStarkletAddress(0, starkKeyPub, accountAddress);
            console.log('STARKLET_ADDRESS=', starkletAddress);
            
            // Save configuration to .env file
            const fs = require('fs');
            const envContent = `
PRIVATE_KEY=${privateKey}
PUBLIC_KEY=${starkKeyPub}
ACCOUNT_ADDRESS=${starkletAddress}
`;
            
            fs.appendFileSync('.env', envContent.trim() + '\n');
            console.log('Configuration appended to .env file');
            
            process.exit(0);
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    } else {
        console.error('Failed to create session');
        process.exit(1);
    }
};

const computeStarkletAddress = (salt: BigNumberish, publicKey: string, accountAddress: string) => {    
  const starkletAddress = hash.calculateContractAddressFromHash(
    salt,
    STARKLET_CLASS_HASH,
    [publicKey],
    STARKLET_FACTORY_ADDRESS
  );
  return starkletAddress;
};

main().catch(console.error);
