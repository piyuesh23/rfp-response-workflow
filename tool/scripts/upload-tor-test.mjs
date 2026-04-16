import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

const s3 = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
});

const engagementId = "cmo0tft3n000001of3jng137f";
const key = `engagements/${engagementId}/tor/DXP-RFP_Ferrellgas-BlueRhino_March2026.pdf`;
const buf = readFileSync("/tmp/ferellgas-tor/DXP-RFP_Ferrellgas-BlueRhino_March2026.pdf");

const cmd = new PutObjectCommand({ Bucket: "presales", Key: key, Body: buf, ContentType: "application/pdf" });
const res = await s3.send(cmd);
console.log("Uploaded:", key, "ETag:", res.ETag);
