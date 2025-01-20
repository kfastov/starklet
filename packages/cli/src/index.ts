import { stark, ec, encode, hash } from 'starknet';
import open from 'open';


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
            const starkletAddress = computeStarkletAddress(sessionToken, starkKeyPub, accountAddress);
            console.log('STARKLET_ADDRESS=', starkletAddress);
            
            // Save configuration to file
            const fs = require('fs');
            const config = {
                privateKey,
                publicKey: starkKeyPub,
                accountAddress,
                starkletAddress
            };
            
            fs.writeFileSync(
                'starklet.config.json',
                JSON.stringify(config, null, 2),
                'utf8'
            );
            console.log('Configuration saved to starklet.config.json');
            
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

const computeStarkletAddress = (salt: string, publicKey: string, accountAddress: string) => {
  // TODO: write real class hash here (or get from server, but we dont trust anyone)
  const STARKLET_CLASS_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
    
  const starkletAddress = hash.calculateContractAddressFromHash(
    salt,
    STARKLET_CLASS_HASH,
    [publicKey],
    accountAddress
  );
  return starkletAddress;
};

main().catch(console.error);
