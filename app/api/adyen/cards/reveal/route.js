import crypto from "node:crypto";
import { adyenPlatformRequest } from "@/lib/adyen";

function toPemPublicKey(base64PublicKey) {
  const normalized = String(base64PublicKey || "").replace(/\s+/g, "");
  if (!normalized) {
    throw new Error("Missing Adyen reveal public key.");
  }

  const wrapped = normalized.match(/.{1,64}/g)?.join("\n") || normalized;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function decodeEncryptedData(encryptedData) {
  const value = String(encryptedData || "").trim();
  if (!value) {
    throw new Error("Reveal response did not include encrypted data.");
  }

  if (/^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0) {
    return Buffer.from(value, "hex");
  }

  const decoded = Buffer.from(value, "base64");
  if (!decoded.length) {
    throw new Error("Reveal response encrypted data format is invalid.");
  }
  return decoded;
}

function parseDecryptedPayload(buffer) {
  const asUtf8 = buffer.toString("utf8").replace(/\0+$/g, "").trim();
  const tryParse = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      return null;
    }
  };

  const direct = tryParse(asUtf8);
  if (direct) return direct;

  const firstBrace = asUtf8.indexOf("{");
  const lastBrace = asUtf8.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = tryParse(asUtf8.slice(firstBrace, lastBrace + 1));
    if (extracted) return extracted;
  }

  const base64Like = /^[A-Za-z0-9+/=\r\n]+$/.test(asUtf8) && asUtf8.length % 4 === 0;
  if (base64Like) {
    const decoded = Buffer.from(asUtf8, "base64").toString("utf8").replace(/\0+$/g, "").trim();
    const parsed = tryParse(decoded);
    if (parsed) return parsed;
  }

  const asUtf16 = buffer.toString("utf16le").replace(/\0+$/g, "").trim();
  const utf16Parsed = tryParse(asUtf16);
  if (utf16Parsed) return utf16Parsed;

  throw new Error("Failed to parse decrypted card details.");
}

function decryptCardRevealData(encryptedData, aesKey) {
  const payload = decodeEncryptedData(encryptedData);
  const attempts = [
    {
      iv: Buffer.alloc(16, 0),
      cipherText: payload,
    },
  ];

  if (payload.length > 16) {
    attempts.push({
      iv: payload.subarray(0, 16),
      cipherText: payload.subarray(16),
    });
  }

  for (const attempt of attempts) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, attempt.iv);
      const decryptedBuffer = Buffer.concat([
        decipher.update(attempt.cipherText),
        decipher.final(),
      ]);
      return parseDecryptedPayload(decryptedBuffer);
    } catch (_error) {
      // Try the next known decryption shape.
    }
  }

  throw new Error("Failed to decrypt card details.");
}

export async function POST(request) {
  try {
    const { paymentInstrumentId } = await request.json();
    if (!paymentInstrumentId) {
      return Response.json({ error: "paymentInstrumentId is required." }, { status: 400 });
    }

    const publicKeyResponse = await adyenPlatformRequest("/publicKey?purpose=panReveal", "GET");
    const publicKeyPem = toPemPublicKey(publicKeyResponse?.publicKey);
    const aesKey = crypto.randomBytes(32);
    const encryptedKey = crypto
      .publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        aesKey
      )
      .toString("hex")
      .toUpperCase();

    const revealResponse = await adyenPlatformRequest("/paymentInstruments/reveal", "POST", {
      paymentInstrumentId,
      encryptedKey,
    });

    const cardDetails = decryptCardRevealData(revealResponse?.encryptedData, aesKey);
    return Response.json({
      paymentInstrumentId,
      pan: cardDetails?.pan || "",
      cvc: cardDetails?.cvc || "",
      expiration: {
        month: cardDetails?.expiration?.month || "",
        year: cardDetails?.expiration?.year || "",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to reveal card details.", details: error.response || null },
      { status: error.status || 500 }
    );
  }
}

