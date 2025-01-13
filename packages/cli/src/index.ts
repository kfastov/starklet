import { stark, ec, encode } from 'starknet';

// Create private-public key pair

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
        }
    })
});

const result = await response.json();
console.log('Server response:', result);

// Verify the signature
// const verified = ec.starkCurve.verify(signature, sessionToken, fullPublicKey);
// console.log('SESSION_TOKEN_VERIFIED=', verified);

// Calculate future address of the Starklet account (TODO)
/*
const AXConstructorCallData = CallData.compile({
  owner: starkKeyPubAX,
  guardian: '0',
});
const AXcontractAddress = hash.calculateContractAddressFromHash(
  starkKeyPubAX,
  argentXaccountClassHash,
  AXConstructorCallData,
  0
);
console.log('Precalculated account address=', AXcontractAddress);
*/

}

main().catch(console.error);