import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare config
 *
 * ไม่ใช้ incremental cache (R2) — แอปนี้เป็น dynamic เกือบทั้งหมด (force-dynamic)
 * จึงไม่ต้องสร้าง R2 bucket → ฟรีและตั้งค่าง่ายกว่า
 * ถ้าภายหลังอยากได้ ISR/cache ค่อยเพิ่ม r2IncrementalCache
 */
export default defineCloudflareConfig();
