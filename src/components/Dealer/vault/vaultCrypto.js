import _sodium from 'libsodium-wrappers';

let _na = null;

async function na() {
  if (!_na) {
    await _sodium.ready;
    _na = _sodium;
  }
  return _na;
}

// HKDF-SHA256 matching Python: HKDF(SHA256, length=32, salt=None, info=b"...")
// Python cryptography salt=None → 32 zero bytes (HashLen for SHA-256, per RFC 5869)
async function hkdfSha256(ikm, infoStr) {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // 32 zero bytes = Python salt=None
      info: new TextEncoder().encode(infoStr),
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Encrypts passphrase P client-side using split-key scheme (matches Python register_vault):
 *   R       = CSPRNG(32 bytes)
 *   key     = HKDF-SHA256(ikm=R, salt=0x00*32, info="manager_dealer_vault_v1")
 *   enc_p   = nonce(12) || ChaCha20-Poly1305-IETF(key, nonce, P)
 *   sealed_r = NaCl SealedBox(pk_M, R)  [X25519 + XSalsa20-Poly1305]
 *
 * Returns hex strings {enc_p, sealed_r} safe to send over WebSocket / store in DB.
 * P and R are zeroed from memory before returning.
 */
export async function encryptPassphrase(passphrase, pkMHex) {
  const s = await na();

  const P = s.from_string(passphrase);
  const pkM = s.from_hex(pkMHex);

  const R = s.randombytes_buf(32);

  const key = await hkdfSha256(R, 'manager_dealer_vault_v1');

  const nonce = s.randombytes_buf(s.crypto_aead_chacha20poly1305_ietf_NPUBBYTES); // 12 bytes
  const ciphertext = s.crypto_aead_chacha20poly1305_ietf_encrypt(P, null, null, nonce, key);

  const encP = new Uint8Array(nonce.length + ciphertext.length);
  encP.set(nonce);
  encP.set(ciphertext, nonce.length);

  const sealedR = s.crypto_box_seal(R, pkM);

  s.memzero(R);
  s.memzero(key);

  return {
    enc_p: s.to_hex(encP),
    sealed_r: s.to_hex(sealedR),
  };
}
