import { createDecipheriv } from "node:crypto";

function decrypt(cipherTextBase64: string, keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const data = Buffer.from(cipherTextBase64, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString("utf8");
}

const cipherText = "xzmoam7zavO4OrQRD1TaBlwmlIGUsUZ7WzVdros5ti9mr/TPHDbyXl35MlWRULt2FMwxrDeJ6BWo8sjwqjA=";
const oldKeyPart1 = "04baf54ac832b79a43a353885b86fd89af92b0d7e831ca207f365f664c5baae0";

try {
    console.log("Decrypted:", decrypt(cipherText, oldKeyPart1));
} catch (err) {
    console.error("Decryption failed:", err.message);
}
